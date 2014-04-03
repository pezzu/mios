var express = require('express');
var oracle = require('oracle');
var q = require('q');
var request = require('request');

var tns = '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=iepe100.isd.dp.ua)(PORT=1521))(CONNECT_DATA=(SERVER = DEDICATED)(SERVICE_NAME=spaten_iepe100.isd)))';
var connData = {'tns': tns, 'user': 'epeprod_ro', 'password': 'epeprod_ro'};

var sql = "\
SELECT LO.ILOGISDIOSLOGIN, TC.IOSTCIEMPAA, TC.IOSTCIN, TC.IOSTCOUT, TC.IOSTCCREATTIME \
FROM EPEPROD.ECISDIOSCLOCKENTRY TC, EPEPROD.ECISDLOGIN LO \
WHERE TC.IOSTCIEMPAA = LO.ILOGIEMPAA \
AND LO.ILOGISDIOSLOGIN = (:1) \
AND To_Date(TC.IOSTCCREATTIME) = To_Date(SYSDATE) \
ORDER BY TC.IOSTCCREATTIME ASC";


var tcStatus = function(user) {

    return q.nfcall(oracle.connect, connData)
    .then(function(connection) {
        return q
            .ninvoke(connection, "execute", sql, [user])
            .then(function(data) {
                connection.close();

                var result = { user: user,
                               clockedIn: false,
                               stats: [] };

                if((data != null) && (data.length > 0)) {
                    result.clockedIn = (data[data.length-1].IOSTCOUT == null);
                                    
                    data.forEach(function(entry) {
                        result.stats.push({'in': entry.IOSTCIN, 'out': entry.IOSTCOUT});
                    });
                }
                return result;
            });
    })
};


var triggerEpe = function(user, pass) {

    var params = {
        screenWidth: 1680,
        screenHeight: 1050,
        scrollWidth: 0,
        bro: 'CR',
        inFrame: false,
        XDPI: 96,
        loginName: user,
        password: pass,
        newPassword: '',
        confirmPassword: '',
        authMethod: '',
        clearID: '',
        http: 'timeClock.do'
    };

    var url = 'http://epe.isd.dp.ua/epe/login.do';

    var opts = {
        url: url, 
        method: 'POST', 
        followAllRedirects: true, 
        jar: true, 
        form: params
    };

    return q.nfcall(request, opts)
    .then(function(res, body) {
        status = false;
        if(res.statusCode == 200) {
            status = true;
        }
        else {
            status = false;
        }
        return status;
    });
}


var clockInOut = function(req, res, requiredStatus) {
    var user = req.query.user;
    var pass = decodeURIComponent(req.query.password);

    q.fcall(tcStatus, user)
    .then(function(result) {
        if(!requiredStatus(result.clockedIn)) {
            return q.fcall(triggerEpe, user, pass)
            .then(function() {
                return tcStatus(user);
            });
        }
        else {
            return result;
        }
    })
    .then(function(data) {
        result = {
           user: user,
           clockedIn: data.clockedIn
        };
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
    })
    .fail(function(error) {
        console.error("[ERROR]: " + error);
        res.status(404);
        result = {
            error: error.toString(),
            user: user };
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
    })
    .done();
}


var app = express();

app.get('/api/timeclock/:user', function(req, res) {

    q.fcall(tcStatus, req.params.user)
    .then(function(result) {

        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));

    })
    .fail(function(error) {
        console.error("[ERROR]: " + error);
        res.status(404);
        result = {
            error: error.toString(),
            user: req.params.user };
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(result));
    })
    .done();
});


app.post('/api/timeclock/in', function(req, res) {
    return clockInOut(req, res, function(status) { return status == true; } );
});


app.post('/api/timeclock/out', function(req, res) {
    return clockInOut(req, res, function(status) { return status == false; } );
});


app.listen(8080);
console.log('Server is running at http://localhost:8080');