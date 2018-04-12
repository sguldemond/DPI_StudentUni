#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
var NodeRSA = require('node-rsa');
var key = new NodeRSA({b:512});

amqp.connect('amqp://localhost', function(err, conn) {
    conn.createChannel(function(err, ch) {
        ch.assertQueue('', {exclusive:true}, function (err, q) {
            var corr = generateUUID();

            ch.consume(q.queue, function(msg) {
                if(msg.properties.correlationId == corr) {
                    console.log('[x] Response: ' + msg.content.toString());
                }
            }, {noAck:true});

            var message = 'Hello RPC world!'
            var ecrMessage = key.encryptPrivate(message, 'base64', 'utf-8').toString();
            var publicPem = key.exportKey('public');

            // var key2 = new NodeRSA({b:512});
            // var publicPem2 = key2.exportKey('public');

            var data = {public_key: publicPem, message: ecrMessage};
            var json = JSON.stringify(data);

            ch.sendToQueue('rpc_queue',
                new Buffer(json),
                {correlationId:corr, replyTo: q.queue});

            console.log('[x] Sent encrypted message: ' + json);
        });
    });
});

function generateUUID() {
    return Math.random().toString() + Math.random().toString() + Math.random().toString();
}