#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
var NodeRSA = require('node-rsa');
var key = new NodeRSA({b:512});
var args = process.argv;

amqp.connect('amqp://localhost', function(err, conn) {
    conn.createChannel(function(err, ch) {
        ch.assertQueue('', {exclusive:true}, function (err, q) {
            var corr = generateUUID();

            ch.consume(q.queue, function(msg) {
                if(msg.properties.correlationId == corr) {
                    console.log('[x] Response: ' + msg.content.toString());
                }
            }, {noAck:true});

            var message = 'Hello RPC world!';
            // var message = args[2];

            var studentNo = "254083";

            var ecrMessage = key.encryptPrivate(message, 'base64', 'utf-8').toString();
            var publicPem = key.exportKey('public');

            // var key2 = new NodeRSA({b:512});
            // var publicPem2 = key2.exportKey('public');

            var data = {
                studentNo: studentNo,
                message: message,
                public_key: publicPem,
                ecrMessage: ecrMessage
            };

            var json = JSON.stringify(data);
            console.log(json);

            var queue = "pm_queue";
            ch.sendToQueue(queue,
                new Buffer(json),
                {correlationId:corr, replyTo: q.queue});

            console.log('[x] Sent encrypted message: ' + json);
        });
    });
});

function generateUUID() {
    return Math.random().toString() + Math.random().toString() + Math.random().toString();
}