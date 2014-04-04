var clockIn = function() {
    device.ajax( 
                {url: 'http://icmn01.isd.dp.ua:8000/api/timeclock/in?user=pesu&password=2me',
                 type: 'POST',
                 headers: {
                     'Content-Type': 'application/x-www-form-urlencoded' // In order for data to be properly processed by the server side
                 },
                 data: ''
                },
        function onSuccess(body, textStatus, response) {
            var parsedBody;
            if(!(body && (parsedBody = JSON.parse(body)))) {
                var error = {
                    message: 'invalid body format',
                    content: body 
                };
                console.error('error: ',error.message);
            }
            if(parsedBody['clockedIn']) {
                device.notifications.createNotification('User logged IN').show();
            }
        },
        function onError(textStatus, response) {
            var notification = device.notifications.createMessageBox('IOS')
            notification.content = textStatus;
            notification.show();
            var error = {};
            error.message = textStatus;
            console.error('error: ', textStatus);
        }
    );
}


var network = 'SCCAIR';

device.network.on("wifiOn", function ()
{
    connection = device.network.status.ssid;
    if(connection == network) {
        clockIn();
    }
});