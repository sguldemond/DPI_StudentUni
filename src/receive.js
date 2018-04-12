#!/usr/bin/env node

var amqp = require('amqplib/callback_api');
var NodeRSA = require('node-rsa');
var key = new NodeRSA();

amqp.connect('amqp://localhost', function (err, conn) {
    conn.createChannel(function (err, ch) {
        var q = 'hello_queue';

        ch.assertQueue(q, {durable:false});

        console.log('[*] Waiting for messages in %s ...', q);

        ch.consume(q, function (msg) {
            console.log('[x] Received message');

            var data = JSON.parse(msg.content.toString());
            var keyData = data.public_key;
            console.log(keyData);

            key.importKey(keyData, 'public');

            var decryptedMessage = key.decryptPublic(data['message'], 'utf8');
            console.log('Message: ' + decryptedMessage);

        }, {noAck:true});
    });
});