var DB;

methods = [
    'join',
    'node',
    'nodeInfo',
    'list',
    'content',
    'moveNode',
    'copyNode',
    'newNode',
    'updateNode',
    'removeNode',
    'nodePath'
]

function constructor() {
    JS.include('private.js');
    JS.include('../common/sqlStmFra.js');
    JS.include('../common/randomStr.js');
    JS.loadModule('jsDB');
    JS.loadModule('jsFile');

    var file = new JsFile;
    if (!file.exists(JS.__PATH_DATA__)) {
        file.mkpath(JS.__PATH_DATA__);
        // file.mkpath(JS.__PATH_DATA__ + '/media');
        file.copy(JS.__PATH_APP__ + '/cms.db', JS.__PATH_DATA__ + '/cms.db');
    }

    DB = new JsDB;
    DB.openDB('cms.db');
}

function join(caller) {
    JS.addRelClient(caller);

    return caller.__ID__;
}

function node(caller) {
    var token = getCallerToken(caller);
    
    var args = [token];
    for (let x = 1; x < arguments.length; x++)
        args[x] = arguments[x];

    return _node.apply(null, args);
}

function nodeInfo(caller) {
    var n = node.apply(null, arguments);

    if (n.ok) 
        delete n.node['content'];

    return n;
}

function list(caller, pNode, filter) {
    var nohide = false;
    var noDotDot = false;
    if (filter != undefined) {
        nohide = filter & 0x01;
        noDotDot = filter & 0x02;
    }

    var token = getCallerToken(caller);

    return _list(pNode, nohide, noDotDot, token);
}

function moveNode(caller, s, t) {
    return _updateNode(s, {
        pid: t
    }, getCallerToken(caller) || "guest");
}

function copyNode(caller, s, t) {
    return _copyNode(s, t, getCallerToken(caller) || "guest");
}

function newNode(caller, p, d) {
    var token = getCallerToken(caller) || "guest";

    var pn = _node(token, p);

    if (!pn.ok)
        return pn;
    else if (pn.node.type === 'F')
        return { ok: false, error: 'target node is not a directory' };
    else if (pn.id !== null && pn.node.own !== token)
        return { ok: false, error: 'permission denied' };
    else
        p = pn.id;

    var stf = insertStatementFragments({
        'pid': p,
        'type': 'F',
        'title': null,
        'summary': null,
        'extData': null,
        'name': null,
        'content': null,
        'contentType': null,
        'own': token,
        'hide': 0,
        'private': 0,
        'seq': -1
    }, d);

    var result = DB.exec('INSERT INTO `VDIR` (' + stf.fstm + ') VALUES (' + stf.vstm + ')', stf.bindValues);
    if (result.ok) {
        var newNode = _node(token, p, d.name);
        JS.emitSignal('nodeCreated', [newNode]);
        return newNode;
    } else
        return result;
}

function updateNode(caller, n, d) {
    return _updateNode(n, d, getCallerToken(caller) || "guest");
}

function removeNode(caller, n) {
    var token = getCallerToken(caller);

    n = _node(token, n);

    if (n.ok) {
        var result = DB.exec('DELETE FROM `VDIR` WHERE `id`=:I', {
            ':I': n.id
        });

        if (result.ok) {
            JS.emitSignal('nodeRemoved', [n.id]);
            if (n.node.type == 'R')
                caller.emitSignal("resourceNodeRemoved",
                    [n.id, n.node.contentType, n.node.content]);
        }

        return result;
    } else
        return n;
}

function nodePath(caller, node) {
    return _nodePath(node, getCallerToken(caller));
}

