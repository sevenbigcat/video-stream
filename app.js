var http = require("http");
var fs = require('fs');


var hostName = process.env['hostName'] || '0.0.0.0';
var port = process.env['port'] || 8080;


var videoPath = 'videos';
var playListPath= process.env['playListPath'] || '/playlist';

var playListVideoLength = process.env['playListVideoLength'] || 3;
var playListVideoRoot = process.env['playListVideoRoot'] || 'http://localhost:8080';
var playListVideoPath = process.env['playListVideoPath'] || '/video-path';

var supports = [
    {
        name: 'master',
        path: playListPath + '/master.m3u8',
        headers: [
            {'Content-Type':'audio/x-mpegurl' },
        ],
        handle: function(req, res, support) {
            var resp = '#EXTM3U\n';
            resp  =  resp + '#EXT-X-STREAM-INF:PROGRAM-ID=1, BANDWIDTH=200000\n';
            resp = resp + playListVideoRoot + playListPath + '/second-level.m3u8\n';
            res.end(resp);
        }
    },
    {
        name: 'second-level',
        headers: [
            {'Content-Type':'audio/x-mpegurl' },
        ],
        path: playListPath + '/second-level.m3u8',
        handle: function(req, res, support) {
            var tick = getTick();
            var resp = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:10
#EXT-X-MEDIA-SEQUENCE:`;
            resp = resp + tick + '\n';
            for (var i = 0; i < playListVideoLength; i++) {
                resp = resp + '#EXTINF:10.000000,\n';
                resp = resp + playListVideoRoot + playListVideoPath + '/' +(tick + i)+ '.ts\n';
                // resp = resp + tickToFileName(tick+i)+ '\n';
            }
            res.end(resp);
        } 
    }, 
    {
        name: 'video-stream',
        pathRE: playListVideoPath+'/[0-9]{1,9}.ts',
        headers: [
            {'Content-Type':'video/mp2t' },
        ],
        handle: function (req, res, support) {
            var tick = req.url.match('[0-9]{1,9}');

            var currentTick = getTick(); 
            if (tick < currentTick - 10 || tick > currentTick + playListVideoLength + 10) {
                res.statusCode = 404
                return res.end('Not Found ' + req.url);
            }
            var videoFileName = tickToFileName(tick);
            var rs = fs.createReadStream(videoFileName);
            rs.pipe(res);
            // rs.close();
            console.log('piped file ' + videoFileName);
        }
    }
];
var readVideos = function() {
    var list = [];
    var files = fs.readdirSync(videoPath);
    files.forEach(f => {
        if (f.endsWith('.ts')) {
            list.push(videoPath + '/' + f);
        }
    });
    return list;
}
var videoList = readVideos();

var getTick = function() {
    return Math.round(new Date().getTime()/10000);
}

var tickToIndex= function(tick) {
    var videoIndex = tick % videoList.length;
    return videoIndex;
}
var tickToFileName= function(tick) {
    var videoIndex = tickToIndex(tick);
    return videoList[videoIndex];
}

var handleHeaders = function(req, res, support) {
    if (support.headers) {
        for (var j in support.headers) {
            var header = support.headers[j];
            for(var k in header) {
                res.setHeader(k, header[k]);
            }
        }
    }
};

var handleResponse = function(req, res,support) {
    if (support.template) {
        res.end(support.template);
    } else if (support.handle) {
        support.handle(req, res, support);
    }
}

var server = http.createServer(function(req,res){
    var method = req.method;
    var url = req.url;
    console.log('request received: ' + url);
    for(var i in supports) {
        var support = supports[i];
        if (support.path) {
            if (req.url == support.path) {
                handleHeaders(req, res, support);
                return handleResponse(req, res, support)
            }
        } else if (support.pathRE) {
            if (req.url.match(support.pathRE)) {
                handleHeaders(req, res, support);
                return handleResponse(req, res, support)
            }
        }
    }

    res.setHeader('Content-Type','text/plain');
    res.end("hello nodejs: " + method + ' ' + url);

});


server.listen(port,hostName,function(){
    console.log('hostName: ' + hostName);
    console.log('port: ' + port);
    console.log('videoList: ' + videoList);
    console.log('videoPath: ' + videoPath);
    console.log('playListPath: ' + playListPath);
    console.log('playListVideoLength: ' + playListVideoLength);
    console.log('playListVideoRoot: ' + playListVideoRoot);
    console.log('playListVideoPath: ' + playListVideoPath);


    console.log(`running http://${hostName}:${port}` );
});
