var express = require('express');
var oracle = require('oracle');
var q = require('q');

var tns = '(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=iepe100.isd.dp.ua)(PORT=1521))(CONNECT_DATA=(SERVER = DEDICATED)(SERVICE_NAME=spaten_iepe100.isd)))';
var connData = {'tns': tns, 'user': 'epeprod_ro', 'password': 'epeprod_ro'};

var sql = "\
SELECT LO.ILOGISDIOSLOGIN, TC.IOSTCIEMPAA, TC.IOSTCIN, TC.IOSTCOUT, TC.IOSTCCREATTIME \
FROM EPEPROD.ECISDIOSCLOCKENTRY TC, EPEPROD.ECISDLOGIN LO \
WHERE TC.IOSTCIEMPAA = LO.ILOGIEMPAA \
AND LO.ILOGISDIOSLOGIN = (:1) \
AND To_Date(TC.IOSTCCREATTIME) = To_Date(SYSDATE) \
ORDER BY TC.IOSTCCREATTIME ASC";

var app = express();

app.get('/api/timeclock/:user', function(req, res) {

    q.nfcall(oracle.connect, connData)
    .then(function(connection) {
        return q
            .ninvoke(connection, "execute", sql, [req.params.user])
            .then(function(data) {
                connection.close();

                var result = { user: req.params.user,
                               clockedIn: false,
                               stats: [] };

                if((data != null) && (data.length > 0)) {
                    result.clockedIn = (data[data.length-1].IOSTCOUT == null);
                                    
                    data.forEach(function(entry) {
                        result.stats.push({'in': entry.IOSTCIN, 'out': entry.IOSTCOUT});
                    });
                }

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result));
            });
    })
    .fail(function(error) {
        console.log("[ERROR]: " + error);
        response.status(404);
        error.status = 404;
        error.user = user;
        response.end(JSON.stringify(error));
    })
    .done();
});


app.put('/api/timeclock', function(req, res) {
    var user = req.query.user;
    var pass = decodeURIComponent(req.query.password);

    console.log('user = ' + user + '\npassword = ' + pass);
    res.end();
});

app.listen(8080);
console.log('Server is running at http://localhost:8080');