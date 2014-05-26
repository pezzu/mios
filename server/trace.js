module.exports.log = function(message) {
    var time = new Date();

    console.log('%d:%d - ' + message, time.getHours(), time.getMinutes());
};