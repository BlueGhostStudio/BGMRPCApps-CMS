// private:
var buffer = [];
var FILE;
var MediaPath;

methods = [
    'requestPostMedia', 'writeMediaData', 'writeMediaDataEnd', 'requestGetMedia',
    'readMediaData', 'removeMedia', 'close', 'mediaURL'
];

function constructor() {
    JS.include('../common/randomStr.js');
    JS.include('mediaConfig.js');
    JS.loadModule('jsFile');
    JS.loadModule('jsByteArray');

    FILE = new JsFile;
    MediaPath = JS.__PATH_DATA__ + '/media/';
    if (!file.exists(MediaPath))
        file.mkpath(MediaPath);
}

function requestPostMedia(caller, type) {
    var id = randomStr(6) + '.' + type;

    buffer[id] = new JsByteArray(true);

    return id;
}

function writeMediaData(caller, id, base64) {
    var ba = new JsByteArray;
    ba.fromBase64(base64);
    buffer[id].append(ba);
    return true;
}

function writeMediaDataEnd(caller, id) {
    FILE.writeFile(MediaPath + id, buffer[id].data());
    close(caller, id);
}

function requestGetMedia(caller, media) {
    var id = randomStr(6);
    var data = JsByteArray(FILE.readFile(MediaPath + media), true);

    if (data.size() > 0) {
        buffer[id] = data;
        return [id, data.size()];
    } else {
        JS.destroyObject(data);
        return false;
    }
}

function readMediaData(caller, id, pos, len) {
    var data = buffer[id].mid(pos, len);
    pos += data.size();
    if (pos >= buffer[id].size()) {
        pos = -1;
        close(caller, id);
    }
    return {data: data.toBase64().data(), pos: pos};
}

function removeMedia(caller, media) {
    return FILE.removeFile(MediaPath + media);
}

function close(caller, id) {
    JS.destroyObject(buffer[id]);
    delete buffer[id];
}

function mediaURL(caller, media) {
    var subDir = 'imgs/default';
    if (JS.__GRP__.length > 0)
        subDir = 'imgs/' + JS.__GRP__
    return mediaUrl + '/' + subDir + '/' + encodeURI(media);
}

