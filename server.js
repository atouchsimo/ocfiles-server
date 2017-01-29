'use strict';

const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const mongoose = require('mongoose');
const uuidV4 = require('uuid/v4');
const mime = require('mime-types');

// Multer disk storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads');
    },
    filename: function (req, file, cb) {
        cb(null, `${uuidV4()}${path.extname(file.originalname)}`);
    }
});
// Instansiate the multer
const upload = multer({
    storage: storage
});
// Data base connection 
mongoose.connect('mongodb://localhost/images');

const conn = mongoose.connection;

const Grid = require('gridfs-stream');
Grid.mongo = mongoose.mongo;

conn.once('open', () => {
    const gfs = Grid(conn.db);

    app.get('/', (req, res) => {
        return res.send({
            api: 'Images files API v0.1.0'
        });
    });

    app.post('/', upload.single('file'), (req, res) => {
        const writeStream = gfs.createWriteStream({
            filename: req.file.filename,
            content_type: mime.contentType(req.file.filename),
            metadata: {
                mime: mime.lookup(path.extname(req.file.filename))
            }
        });
        fs.createReadStream(`./uploads/${req.file.filename}`)
            .on('end', () => {
                fs.unlink(`./uploads/${req.file.filename}`, (err) => {
                    return res.send({
                        ok: true,
                        fileName: req.file.filename,
                        filePath: `http://localhost:3000/${req.file.filename}`,
                        message: 'File has been successfully created'
                    });
                });
            })
            .on('error', (err) => {
                return res.send({
                    ok: false,
                    message: 'Error uploading image',
                    error: err.message
                });
            })
            .pipe(writeStream);
    });

    app.get('/:filename', (req, res) => {
        gfs.findOne({
            filename: req.params.filename
        }, function (err, file) {
            if (err) {
                return res.send({
                    ok: false,
                    message: err.message
                });
            }
            if (!file) {
                return res.send({
                    ok: false,
                    message: 'File not found!'
                });
            }
            res.type(file.contentType);
            const readStream = gfs.createReadStream({
                filename: req.params.filename
            });

            readStream.on('error', (err) => {
                res.send('No image found with that title');
            });
            readStream.pipe(res);
        });
    });

    app.delete('/:filename', (req, res) => {
        gfs.findOne({
            filename: req.params.filename
        }, function (err, file) {
            if (err) {
                return res.send({
                    ok: false,
                    message: err.message
                });
            }
            if (!file) {
                return res.send({
                    ok: false,
                    message: 'File not found!'
                });
            }
            gfs.remove({
                filename: req.params.filename
            }, function (err) {
                if (err) {
                    return res.send({
                        ok: false,
                        message: 'Something went wrong please try later',
                        error: err.message
                    });
                }
                return res.send({
                    ok: true,
                    message: `${req.params.filename} has been successfully deleted!`
                });
            });
        });
    });
});

app.listen(3000);