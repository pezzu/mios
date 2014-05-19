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

module.exports.timeclockStatus = function(user) {

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

module.exports.turnstileStatus = function (user) {
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
};


module.exports.triggerTimeclock = function(user, pass) {

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
};