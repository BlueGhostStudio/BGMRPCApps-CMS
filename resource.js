// private:
var buffer = [];
var FILE;
var ResPath;

methods = [
    'requestPostImg', 'writeImgData', 'writeImgDataEnd', 'requestGetImg',
    'readImgData', 'removeImg', 'close', 'imgURL'
];

function constructor() {
    JS.include('../common/randomStr.js');
    JS.include('resConfig.js');
    JS.loadModule('jsFile');
    JS.loadModule('jsByteArray');

    FILE = new JsFile;
    ResPath = JS.__PATH_DATA__ + '/' +
        'resource/';
}

function requestPostImg(caller) {
    var id = randomStr(6) + '.png';

    buffer[id] = new JsByteArray(true);

    return id;
}

function writeImgData(caller, id, base64) {
    var ba = new JsByteArray;
    ba.fromBase64(base64);
    buffer[id].append(ba);
    return true;
}

function writeImgDataEnd(caller, id) {
    FILE.writeFile(ResPath + id, buffer[id].data());
    close(caller, id);
}

function requestGetImg(caller, img) {
    var id = randomStr(6);
    var data = JsByteArray(FILE.readFile(ResPath + img), true);

    if (data.size() > 0) {
        buffer[id] = data;
        return [id, data.size()];
    } else {
        JS.destroyObject(data);
        return false;
    }
}

function readImgData(caller, id, pos, len) {
    var data = buffer[id].mid(pos, len);
    pos += data.size();
    if (pos >= buffer[id].size()) {
        pos = -1;
        close(caller, id);
    }
    return {data: data.toBase64().data(), pos: pos};
}

function removeImg(caller, img) {
    return FILE.removeFile(ResPath + img);
}

function close(caller, id) {
    JS.destroyObject(buffer[id]);
    delete buffer[id];
}

function imgURL(caller, img) {
    return resUrl + encodeURI(img);
}

