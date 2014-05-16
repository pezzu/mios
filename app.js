var express = require('express');
var oracle = require('oracle');
var q = require('q');
var request = require('request');

var tns = '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=iepe100.isd.dp.ua)(PORT=1521))(CONNECT_DATA=(SERVER = DEDICATED)(SERVICE_NAME=spaten_iepe100.isd)))';
var connData = {'tns': tns, 'user': 'epeprod_ro', 'password': 'epeprod_ro'};

var iosSql = "\
SELECT LO.ILOGISDIOSLOGIN, TC.IOSTCIEMPAA, TC.IOSTCIN, TC.IOSTCOUT, TC.IOSTCCREATTIME \
FROM EPEPROD.ECISDIOSCLOCKENTRY TC, EPEPROD.ECISDLOGIN LO \
WHERE TC.IOSTCIEMPAA = LO.ILOGIEMPAA \
AND LO.ILOGISDIOSLOGIN = (:1) \
AND To_Date(TC.IOSTCCREATTIME) = To_Date(SYSDATE) \
ORDER BY TC.IOSTCCREATTIME ASC";

var fortnetSql = "\
SELECT TS.NN, TS.ACTION, TS.ACT_DATE_TIME \
FROM TABLE(isd_ios.getTimeByDate((SELECT LO.ILOGIEMPAA FROM EPEPROD.ECISDLOGIN LO WHERE LO.ILOGISDIOSLOGIN = (:1)))) TS \
ORDER BY TS.NN DESC";

var autoUsers = [
    {name: 'pesu', password: '2me', email: 'peter.sukhenko@gmail.com'}
];

var timeclockStatus = function(user) {

    return q.nfcall(oracle.connect, connData)
    .then(function(connection) {
        return q
            .ninvoke(connection, "execute", iosSql, [user])
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


var turnstileStatus = function (user) {
    return q.nfcall(oracle.connect, connData)
    .then(function(connection) {
        return q
            .ninvoke(connection, "execute", fortnetSql, [user])
            .then(function(data) {
                connection.close();

                var result = { user: user,
                               checkedIn: false,
                               stats: [] };

                if((data != null) && (data.length > 0)) {
                    result.checkedIn = (data[data.length-1].ACTION == 'IN')

                    for (var i = 0; i < data.length; i+=1) {

                        var entry = {};
                        if(data[i].ACTION == 'IN') {
                            entry['in'] = data[i].ACT_DATE_TIME;
                            entry['out'] = (i<data.length-1)? data[i+1].ACT_DATE_TIME : null;
                            i++;
                        }
                        else if(data[i].ACTION == 'OUT') {
                            entry['in'] = null;
                            entry['out'] = data[i].ACT_DATE_TIME;
                        }
                        result.stats.push(entry);
                    }
                }

                return result;
            });
    });
}

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

    q.fcall(timeclockStatus, user)
    .then(function(result) {
        if(!requiredStatus(result.clockedIn)) {
            return q.fcall(triggerEpe, user, pass)
            .then(function() {
                return timeclockStatus(user);
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

    q.fcall(timeclockStatus, req.params.user)
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

function notify(user) {

    if(user.email != null) {
        var params = {
            token: '98cd67e4dc4511e391ad00163e00103d',
            emails: user.email,
            message: 'User ' + user.name + ' logged in'
        };

        var url = 'https://api.jeapie.com/v2/users/send/message.json';

        var opts = {
            url: url,
            method: 'POST',
            proxy: 'http://proxy.isd.dp.ua:8080',
            form: params
        };

        request(opts);
    }
}

function autoLogin(user) {
    return turnstileStatus(user.name)
    .then(function(ts) {
        if(ts.checkedIn) {
            timeclockStatus(user.name)
            .then(function(tc) {
                if((!tc.clockedIn) &&
                   ((tc.stats.length == 0) || (tc.stats[tc.stats.length-1].out == null) || (tc.stats[tc.stats.length-1].out <= ts.stats[ts.stats.length-1].in))) {
                        triggerEpe(user.name, user.password)
                        .then(function(result) {
                            if(result) {
                                notify(user);
                            }
                        })
                }
            })
        }
    })
    .done();
}

var onTimeTrigger = function() {
    autoUsers.forEach(autoLogin);
}

setInterval(onTimeTrigger, 1*60*1000); // each 1 minute

app.listen(8080);
console.log('Server is running at http://localhost:8080');