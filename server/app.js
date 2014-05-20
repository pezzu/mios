var express = require('express');
var q = require('q');
var request = require('request');

var config = require('./config.js');
var epe = require('./epe.js');
var jeapie = require('./jeapie.js');


var clockInOut = function(req, res, requiredStatus) {
    var user = req.query.user;
    var pass = decodeURIComponent(req.query.password);

    q.fcall(epe.timeclockStatus, user)
    .then(function(result) {
        if(!requiredStatus(result.clockedIn)) {
            return q.fcall(epe.triggerTimeclock, user, pass)
            .then(function() {
                return epe.timeclockStatus(user);
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

    q.fcall(epe.timeclockStatus, req.params.user)
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

function autoLogin(user) {
    return epe.turnstileStatus(user.name)
    .then(function(ts) {
        if(ts.checkedIn) {
            epe.timeclockStatus(user.name)
            .then(function(tc) {
                if((!tc.clockedIn) &&
                   ((tc.stats.length == 0) || (tc.stats[tc.stats.length-1].out == null) || (tc.stats[tc.stats.length-1].out <= ts.stats[ts.stats.length-1].in))) {
                        epe.triggerTimeclock(user.name, user.password)
                        .then(function(result) {
                            if(result) {
                                jeapie.notify(user.email, 'User ' + user.name + ' clocked in');
                            }
                        })
                }
            })
        }
    })
    .done();
}

var onTimeTrigger = function() {
    config.autoUsers.forEach(autoLogin);
}

setInterval(onTimeTrigger, config.autoCheckInterval); // each 1 minute

app.listen(config.appPort);
console.log('Server is running at port ' + config.appPort);