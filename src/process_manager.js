#!/usr/bin/env node

var amqp = require('amqplib/callback_api');

// object to track messages and return status updates
var pending = {};

amqp.connect('amqp://localhost', function (err, conn) {
    conn.createChannel(function (err, ch) {
        var queue = 'pm_queue';

        ch.assertQueue(queue, {durable:false});

        console.log('[*] Process Manager is waiting for messages on %s ...', q);

        ch.consume(q, function (msg) {
            console.log('[x] Received message');

            var data = JSON.parse(msg.content.toString());
            var resPublicKey = data.public_key;


        })
    })
})