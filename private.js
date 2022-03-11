var infoFields = '`pid`,`id`,`type`,`title`,`name`,`contentType`,`own`,`hide`,`private`,`date`,`mdate`,`seq` ';
var rootNode = {
    pid: null,
    id: null,
    title: '/',
    type: 'D'
}

function getCallerToken(caller) {
    return JS.call(caller, 'account', 'getToken', [])[0];
}

function _nodeByID(id, token) {
    //console.log("id", id, "token", token);
    var result = DB.exec('SELECT * '
        + 'FROM VDIR '
        + 'WHERE `id`=:I AND (`own`=:T OR `private`=0)', {':I': id, ':T': token});

    if (result.ok && result.rows.length > 0) {
        var id = result.rows[0].id;
        if (id != null && id < 0) {
            id = -id;
            result.rows[0].id = id;
        }

        return {
            ok: true,
            id: id,
            node: result.rows[0]
        };
    } else
        return { ok: false, error: 'no exist node' };
}

function _nodeByName(pid, name, token) {
    if (pid === '')
        pid = null;

    var result = DB.exec('SELECT * '
        + 'FROM VDIR '
        + 'WHERE IIF(:P IS NULL, `pid` IS NULL, `pid`=ABS(:P)) '
        + ' AND `name`=:N AND (`own`=:T OR `private`=0)',
        {
            ':P': pid,
            ':N': name,
            ':T': token
        });

    if (result.ok && result.rows.length > 0) {
        var id = result.rows[0].id;
        if (id != null && id < 0) {
            id = -id;
            result.rows[0].id = id;
        }

        return {
            ok: true,
            id: id,
            node: result.rows[0]
        };
    } else
        return { ok: false, error: 'no exist node' };
}

function _nodeByPath(path, token) {
    path = path.trim();

    var sp = path.split('/');
    var n = {ok: true, id: null, node: rootNode};

    for (var x in sp) {
        let name = sp[x];
        if (name !== '') {
            n = _nodeByName(n.id, name, token);

            if (!n.ok)
                break;
        }
    }

    return n;
}

function _node(token) {
    if (arguments.length == 2) {
        var n = arguments[1];
        if (n == null)
            return { ok: true, id: null, node: rootNode };
        else if (typeof n === 'number')
            return _nodeByID(n, token);
        else if (typeof n === 'string')
            return _nodeByPath(n, token);
        else
            return { ok: false, id: null, error: 'type error' };
    } else if (arguments.length > 2) {
        var pnode = _node(token, arguments[1]);
        if (!pnode.ok)
            return pnode;
        else
            return _nodeByName(pnode.id, arguments[2], token);
    } else
        return { ok: false, id: null, error: 'arguments count fail' };
}

function _list(pNode, nohide, noDotDot, token) {
    pNode = _node(token, pNode);

    if (!pNode.ok)
        return pNode;
    else if (pNode.node.type === 'F')
        return { ok: false, error: 'the node is not directory node' };

    var result = DB.exec('SELECT ' + infoFields
        + 'FROM VDIR '
        + 'WHERE IIF(:P IS NULL, `pid` IS NULL, `pid`=ABS(:P)) '
        + 'AND (`own`=:T OR `private`=0) ' + (nohide ? 'AND `hide`=0 ' : ' ')
        + (noDotDot ? 'AND `id`>0 ' : ' ')
        + "ORDER BY IIF(`type`='D', 0, 1)", {
            ':P': pNode.id,
            ':T': token
        });

    return {
        ok: true, id: pNode.id,
        path: _nodePath(pNode.id, token),
        list: result.rows
    };
}

function _updateNode(n, d, token) {
    var n = _node(token, n);
    if (!n.ok)
        return n;
    else if (n.node.own !== token)
        return { ok: false, error: 'permission denied' };

    var nID = n.id;
    var pID = n.node.pid == '' ? null : n.node.pid;

    var isMove = false;
    if ('pid' in d) {
        var pn = _node(token, d['pid'])

        if (!pn.ok)
            return pn;
        else if (pn.id != null && pn.node.own !== token)
            return { ok: false, error: 'permission denied' };
        else
            d.pid = pn.id;

        if (pn.id != pID) {
            var chpn = pn;
            while(chpn.id != null) {
                if (chpn.id == nID)
                    return { ok: false, error: 'cannot move node to a subdirectory of itself' };

                chpn = _node(token, chpn.node.pid);
            }

            isMove = true;
        } else {
            console.log("----same pnode----");
            delete d.pid;
        }
        /*if (pn.id != pID) {
            var chpn = pn;

            while(chpn.node.pid != null) {
                if (chpn.node.pid === nID)
                    return { ok: false, error: 'cannot move node to a subdirectory of itself' };

                chpn = _node(token, chpn.pid);
            }

            if (!pn.ok)
                return pn;
            else if (pn.id !== null && pn.node.own !== token)
                return { ok: false, error: 'permission denied' };
            else
                d.pid = pn.id;
            isMove = true;
        } else {
            console.log("------same pnode---");
            delete d.pid;
        }*/
    }

    var stf = updateStatementFragments([
        'pid',
        'name',
        'title',
        'summary',
        'extData',
        'content',
        'contentType',
        'hide',
        'private',
        'seq'
    ], d);
    stf.bindValues[':I'] = nID;

    if (Object.keys(stf.bindValues).length == 1)
        return { ok: false, error: 'no data update' }

    var result = DB.exec('UPDATE `VDIR` SET ' + stf.stm + ' WHERE `id`=:I', stf.bindValues);
    if (result.ok) {
        /*if ('pid' in d && d.pid != pID)
            JS.emitSignal('nodeMoved', [nID, d.pid])
        if ('name' in d)
            JS.emitSignal('nameUpdated', [nID, d.name]);
        if ('title' in d)
            JS.emitSignal('titleUpdated', [nID, d.title]);
        if ('content' in d)
            JS.emitSignal('contentUpdated', [nID, d.content]);
        if ('contentType' in d)
            JS.emitSignal('contentTypeUpdated', [nID, d.contentType]);
        if ('hide' in d)
            JS.emitSignal('hideUpdated', [nID, d.hide]);
        if ('private' in d)
            JS.emitSignal('privateUpdated', [nID, d.private]);
        if ('seq' in d)
            JS.emitSignal('seqUpdated', [nID, d.seq]);*/

        var updatedNode = _node(token, nID);
        if ('content' in d)
            JS.emitSignal('contentUpdated', [nID, d.content]);
        if ('summary' in d)
            JS.emitSignal('summaryUpdated', [nID, d.summary]);
        if ('extData' in d)
            JS.emitSignal('extDataUpdated', [nID, d.extData]);

        delete updatedNode.node["content"];
        updatedNode.move = isMove;

        if ('pid' in d && d.pid != pID)
            JS.emitSignal('nodeMoved', [updatedNode, d.pid]);

        /*if ('title' in d || 'contentType' in d || 'hide' in d
            || 'private' in d || 'seq' in d)
            JS.emitSignal("nodeUpdated", [nID, updatedNode]);*/
        var ks = Object.keys(d);
        if ('name' in d)
            JS.emitSignal('nodeRenamed', [nID, d['name']]);
        if (ks.some(elem=>['name', 'title', 'summary', 'extData', 'contentType', 'hide',
            'private', 'seq'].includes(elem)))
            JS.emitSignal('nodeUpdated', [nID, updatedNode]);

        return updatedNode;
    } else
        return result;
}

function _copyNode(s, t, token) {
    var s = _node(token, s);
    if (!s.ok)
        return s;
    else if (s.id == null)
        return { ok: false, error: 'cannot copy root node' };
    else if (s.node.own !== token)
        return { ok: false, error: 'permission denied' };
    var sID = s.id;
    var sPID = s.node.pid == '' ? null : s.node.pid;
    var sName = s.node.name;

    var t = _node(token, t);
    if (!t.ok)
        return t;
    else if (t.id != null && t.node.own !== token)
        return { ok: false, error: 'permission denied' };
    var tID = t.id;

    if (sPID != tID) {
        var cht = t;
        while(cht.id != null) {
            if (cht.id == sID)
                return { ok: false, error: 'cnnot copy node to a subdirectory of itself' };

            cht = _node(token, cht.node.pid);
        }
    } else
        sName += '_copy_' + randomStr(6);

    var result = DB.exec('INSERT INTO `VDIR` ' + 
        '(`pid`, `name`, `type`, `title`, ' +
        '`content`, `contentType`, ' +
        '`own`, `private`, hide) ' +
        'SELECT :P AS `pid`, :N AS `name`, `type`, `title`, ' +
        '`content`, `contentType`, ' +
        '`own`, `private`, `hide` ' +
        'FROM `VDIR` ' +
        'WHERE `id`=:I', {
            ':P': tID,
            ':N': sName,
            ':I': sID
        });

    if (result.ok) {
        var newNode = _node(token, tID, sName);
        JS.emitSignal('nodeCopied', [newNode]);

        console.log(">>>>>>>>>", sID, s.node.type, newNode.node.type);

        if (s.node.type == 'D' && newNode.node.type == 'D') {
            var subList = _list(sID, false, true, token);

            if (subList.ok) {
                subList = subList.list;
                for (let x in subList) {
                    console.log(">>> copy subnode >>>", subList[x].id, newNode.id);
                    _copyNode(subList[x].id, newNode.id, token);
                }
            }
        }

        return newNode;
    } else
        return result;
}

function _nodePath(node, token) {
    var path = {
        str: "",
        ids: []
    }

    node = _node(token, node);
    while (node.ok && node.id != null) {
        path.str = node.node.name + (path.str == '' ? '' : '/' + path.str);
        path.ids.unshift(node.id);
        node = _node(token, node.node.pid);
    }

    path.str = '/' + path.str;

    return path;
}
/*function _nodePath(node, token) {
    var path = "";

    node = _node(token, node);
    while (node.ok && node.id != null) {
        path = node.node.name + (path == '' ? '' : '/' + path);
        node = _node(token, node.node.pid);
    }

    return '/' + path;
}

function _nodePathIDs(node, token) {
    var path = [];

    node = _node(token, node);
    while (node.ok && node.id != null) {
        path.unshift(node.id);
        node = _node(token, node.node.pid);
    }

    return path;
}*/

