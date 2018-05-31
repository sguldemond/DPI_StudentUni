#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
var NodeRSA = require('node-rsa');
var uuid = require('uuid/v4');
var args = process.argv;

var connection;
var key = new NodeRSA({b:512});


amqp.connect('amqp://localhost', function (err, conn) {
    if(err != undefined) {
        console.error(err);
    } else {
        connection = conn;
        sendMessage()
    }
});

function sendMessage() {
    connection.createChannel(function(err, ch) {
        ch.assertQueue('', {exclusive:true}, function (err, q) {
            var corr = uuid();

            ch.consume(q.queue, function(msg) {
                if(msg.properties.correlationId === corr) {
                    console.log('[x] Response: ' + msg.content.toString());
                }
            }, {noAck:true});

            // var message = 'Hello RPC world!';
            var message = args[2];

            var studentNo = "254083";

            var ecrMessage = key.encryptPrivate(message, 'base64', 'utf-8').toString();
            var publicPem = key.exportKey('public');

            var data = {
                student_no: studentNo,
                message: message,
                public_key: publicPem,
                ecr_message: ecrMessage
            };

            var jsonData = JSON.stringify(data);

            var queue = "pm_queue";
            ch.sendToQueue(queue,
                new Buffer(jsonData),
                {correlationId:corr, replyTo: q.queue});

            var response = "[x] Sent encrypted message with corrId: ";
            console.log(response + corr);
        });
    });
}