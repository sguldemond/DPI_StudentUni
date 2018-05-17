#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

// list to track messages and return status updates
var requests = [];

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

            requests.push({
                meta_data: metaData,
                content: content
            });

            var hvMessage = JSON.stringify({
                public_key: content.public_key,
                ecr_message: content.ecr_message
            });

            startValidation(hvMessage, conn);

            var response = "Request received";
            ch.sendToQueue(msg.properties.replyTo,
                new Buffer(response),
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
                }
            }, {noAck:true});

            ch.sendToQueue('hv_queue',
                new Buffer(message),
                {correlationId:corr, replyTo: q.queue});

            console.log('[*] Sent message for validation...');
        })
    })
}

function generateUUID() {
    return Math.random().toString() + Math.random().toString() + Math.random().toString();
}