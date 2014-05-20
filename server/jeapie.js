var request = require('request');


module.exports.notify = function(email, message) {

    var params = {
        token: '98cd67e4dc4511e391ad00163e00103d',
        emails: email,
        message: message
    };

    var url = 'https://api.jeapie.com/v2/users/send/message.json';

    var opts = {
        url: url,
        method: 'POST',
        proxy: 'http://proxy.isd.dp.ua:8080',
        form: params
    };

    request(opts);
};

