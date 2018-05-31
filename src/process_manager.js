#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
var uuid = require('uuid/v4');

var connection;
var request_status = [];

amqp.connect('amqp://localhost', function (err, conn) {
    if(err != undefined) {
        console.error(err);
    } else {
        connection = conn;
        onConnect();
    }
});

function onConnect() {
    connection.createChannel(function (err, ch) {
        var queue = 'pm_queue';

        ch.assertQueue(queue, {durable:false});

        console.log('[*] Process Manager is waiting for messages on %s ...', queue);

        ch.consume(queue, function (msg) {
            console.log('[x] Received message');

            var meta_data = {
                reply_queue: msg.properties.replyTo,
                req_id: msg.properties.correlationId
            };

            var content = JSON.parse(msg.content.toString());
            var status = {validated: false, graded: false};

            request_status.push({
                meta_data: meta_data,
                content: content,
                status: status
            });

            var hvMessage = JSON.stringify({
                public_key: content.public_key,
                ecr_message: content.ecr_message,
                req_id: meta_data.req_id
            });

            startValidation(hvMessage);

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

function startValidation(message) {
    connection.createChannel(function (err, ch) {
        ch.assertQueue('', {exclusive:false}, function (err, q) {
            var corr = uuid();

            ch.consume(q.queue, function (msg) {
                if(msg.properties.correlationId === corr) {
                    console.log('[x] Response from validator: ' + msg.content.toString());

                    var valReply = JSON.parse(msg.content.toString());

                    if(valReply.validated === true) {
                        request_status.forEach(function (x) {
                            if(x.meta_data.req_id === valReply.req_id) {
                                x.status.validated = true;
                                updateStatus(x.meta_data, x.status);

                                var gradeMessage = JSON.stringify({
                                    message: x.content.message,
                                    req_id: x.meta_data.req_id
                                });
                                startGradingProcess(gradeMessage);
                            }
                        })
                    }
                }
            }, {noAck:true});

            ch.sendToQueue('hv_queue',
                new Buffer(message),
                {correlationId: corr, replyTo: q.queue});

            console.log('[*] Sent message for validation...');
        });
    });
}

function startGradingProcess(message) {
    connection.createChannel(function (err, ch) {
        ch.assertQueue('', {exclusive:false}, function (err, q) {
            var corr = uuid();

            ch.consume(q.queue, function(msg) {
                if(msg.properties.correlationId === corr) {
                    console.log('[x] Response from grader: ' + msg.content.toString());
                    var gradReply = JSON.parse(msg.content.toString());

                    if(gradReply.graded === true) {
                        request_status.forEach(function (x) {
                            if(x.meta_data.req_id === gradReply.req_id) {
                                x.status.graded = true;
                                updateStatus(x.meta_data, x.status);
                            }
                        });
                    }
                }
            }, {noAck:true});

            ch.sendToQueue('gd_queue',
                new Buffer(message),
                {correlationId: corr, replyTo: q.queue});

            console.log('[*] Sent message for grading...');
        })
    })
}

function updateStatus(clientData, status) {
    connection.createChannel(function (err, ch) {
        ch.assertQueue('', {exclusive:false}, function (err, q) {
            var jsonStatus = JSON.stringify(status);
            ch.sendToQueue(clientData.reply_queue,
                new Buffer(jsonStatus),
                {correlationId:clientData.req_id});

            console.log('[x] Sent status update');
        });
    });
}