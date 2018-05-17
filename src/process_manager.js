#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

// list to track messages and return status updates
var request_status = [];

amqp.connect('amqp://localhost', function (err, conn) {
    onConnect(err, conn);
});

function onConnect(err, conn) {
    conn.createChannel(function (err, ch) {
        var queue = 'pm_queue';

        ch.assertQueue(queue, {durable:false});

        console.log('[*] Process Manager is waiting for messages on %s ...', queue);

        ch.consume(queue, function (msg) {
            console.log('[x] Received message');

            var metaData = {
                reply_queue: msg.properties.replyTo,
                req_id: msg.properties.correlationId
            };

            var content = JSON.parse(msg.content.toString());
            var status = {validated: false, graded: false};

            request_status.push({
                meta_data: metaData,
                content: content,
                status: status
            });

            var hvMessage = JSON.stringify({
                public_key: content.public_key,
                ecr_message: content.ecr_message,
                req_id: metaData.req_id
            });

            startValidation(hvMessage, conn);

            var jsonResponse = JSON.stringify({
                response: "Request received",
                status: status
            });

            ch.sendToQueue(msg.properties.replyTo,
                new Buffer(jsonResponse),
                {correlationId: msg.properties.correlationId});
            ch.ack(msg);

            // send status to client > message being processed?

        });
    });
}

function startValidation(message, conn) {
    conn.createChannel(function (err, ch) {
        ch.assertQueue('', {exclusive:false}, function (err, q) {
            var corr = generateUUID();

            ch.consume(q.queue, function (msg) {
                if(msg.properties.correlationId === corr) {
                    console.log('[x] Response from validator: ' + msg.content.toString());

                    var valReply = JSON.parse(msg.content.toString());

                    if(valReply.validated === true) {
                        request_status.forEach(function (x) {
                            if(x.meta_data.req_id === valReply.req_id) {
                                x.status.validated = true;

                                updateStatus(x.meta_data, x.status, conn);
                            }
                        })
                    }
                }
            }, {noAck:true});

            ch.sendToQueue('hv_queue',
                new Buffer(message),
                {correlationId:corr, replyTo: q.queue});

            console.log('[*] Sent message for validation...');
        })
    })
}

function updateStatus(clientData, status, conn) {
    conn.createChannel(function (err, ch) {
        ch.assertQueue('', {exclusive:false}, function (err, q) {
            var jsonStatus = JSON.stringify(status);
            console.log("Client queue: " + clientData.reply_queue);

            ch.sendToQueue(clientData.reply_queue,
                new Buffer(jsonStatus),
                {correlationId:clientData.req_id});

            console.log('[x] Sent status update');
        })
    })
}

function generateUUID() {
    return Math.random().toString() + Math.random().toString() + Math.random().toString();
}