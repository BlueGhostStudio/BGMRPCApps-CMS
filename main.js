var DB;
var m_collectionLastIndex = 0;
var m_resourceLastIndex = 0;
methods = [
    'join', 'collections', 'collection', 'newCollection', 'updateCollection',
    'deleteCollection', 'categories', 'category', 'addCategory',
    'updateCategory', 'deleteCategory', 'resources', 'resource',
    'resourceContent', 'addResource', 'updateResource', 'deleteResource'
];

function constructor() {
    JS.include('private.js');
    JS.include('../common/sqlStmFra.js');
    JS.loadModule('jsDB');

    DB = new JsDB;
    DB.openDB('cms.db');
}

function join(caller) {
    JS.addRelClient(caller);

    return caller.__ID__;
}

function collections(caller) {
    var token = getCallerToken(caller);
    return DB
        .exec(
            'SELECT * ' +
                'FROM `collections` ' +
                'WHERE `private`!=1 OR `own`=:T ' +
                'ORDER BY iif(`seq`=-1,1,0),`seq`',
            {':T': token})
        .rows;
}

function collection(caller, id) {
    return DB.exec('SELECT * FROM `collections` WHERE `id`=:ID', {':ID': id})
        .rows[0];
}

function newCollection(caller, coll) {
    var token = getCallerToken(caller);

    if (token != null) {
        var stmFra = insertStatementFragments(
            {
                'title': 'No Title',
                'alias': null,
                'desc': '',
                'seq': -1,
                'own': token,
                'private': 0
            },
            coll, (fn, newData, data) => {
                if (fn === 'alias' && data[fn].length === 0)
                    return null;
                else
                    return false;
            });

        var result = DB.exec(
            'INSERT INTO `collections` (' + stmFra.fstm + ') VALUES (' +
                stmFra.vstm + ')',
            stmFra.bindValues);

        if (result.ok) {
            newColl = collection(caller, result.lastInsert);
            JS.emitSignal('newCollection', [newColl]);
            return true;
        } else
            return false;
    } else
        return false;
}

function updateCollection(caller, cID, coll) {
    if (checkOwn(cID, getCallerToken(caller)) === 1) {
        var stmFra = updateStatementFragments(
            ['title', 'alias', 'desc', 'seq', 'private'], coll,
            (fn, fields, data) => {
                if (fn === 'alias' && data[fn].length === 0)
                    return null;
                else
                    return false;
            });

        stmFra.bindValues[':cID'] = cID;

        if (DB.exec(
                  'UPDATE `collections` SET ' + stmFra.stm + ' WHERE `id`=:cID',
                  stmFra.bindValues)
                .ok) {
            var updatedColl = collection(caller, cID);
            JS.emitSignal('updatedCollection', [updatedColl]);
            return true;
        } else
            return false;
    } else
        return false;
}

function deleteCollection(caller, cID) {
    if (checkOwn(cID, getCallerToken(caller)) === 1) {
        var result =
            DB.exec('DELETE FROM `collections` WHERE `id`=:cID', {':cID': cID});

        if (result.ok) {
            JS.emitSignal('deletedCollection', [cID]);
            DB.exec('DELETE FROM `categories` WHERE `cid`=:cID', {':cID': cID});
            DB.exec('DELETE FROM `resources` WHERE `cid`=:cID', {':cID': cID});
        }

        return result.ok;
    } else
        return false;
}

function categories(caller, cID, all) {
    // var cond = all === false ? ' AND `title` NOT LIKE \'.%\'' : '';
    var cond = (all === false ? ' AND `hide`=false' : '');
    var token = getCallerToken(caller);

    var rows =
        DB.exec(
              'SELECT a.* ' +
                  'FROM `categories` AS a ' +
                  'LEFT JOIN `collections` AS b ' +
                  'ON a.`cid`=b.`id` ' +
                  'WHERE a.`cid`=:cID ' +
                  'AND ((a.`private`!=1 AND b.`private`!=1) OR b.`own`=:token)' +
                  cond + ' ORDER BY iif(a.`seq`=-1,1,0),a.`seq`',
              {':cID': cID, ':token': token})
            .rows;
    rows.unshift({
        'id': -1,
        'cid': cID,
        'title': 'Uncategory',
        'seq': -1,
        'hide': false
    });

    return rows;
}

function category(caller, cateID) {
    return DB.exec('SELECT * FROM `categories` WHERE id=:ID', {':ID': cateID})
        .rows[0];
}

function addCategory(caller, cID, cate) {
    if (checkOwn(cID, getCallerToken(caller)) === 1) {
        var newCate =
            {'title': 'No Tile', 'alias': null, 'seq': -1, 'hide': false};

        for (var x in cate) newCate[x] = cate[x];
        var result = DB.exec(
            'INSERT INTO `categories` (`cid`, `title`, `alias`, `seq`, `hide`) VALUES (:cID, :title, :alias, :seq, :hide)',
            {
                ':cID': cID,
                ':title': newCate['title'],
                ':alias': newCate['alias'],
                ':seq': newCate['seq'],
                ':hide': newCate['hide']
            })

        if (result.ok) {
            var newCate = category(caller, result.lastInsert);
            JS.emitSignal('addedCategory', [newCate]);
            return true;
        }
        else return false;
    } else
        return false;
}

function updateCategory(caller, cateID, cate) {
    var rows = DB.exec('SELECT * FROM `categories` WHERE `id`=:cateID', {
                     ':cateID': cateID
                 }).rows;
    if (rows.length === 0) return false;
    var cID = rows[0].cid;

    if (checkOwn(cID, getCallerToken(caller)) === 1) {
        var stmFra = updateStatementFragments(
            ['cid', 'title', 'alias', 'seq', 'hide', 'private'], cate,
            (fn, fields, data) => {
                if (fn === 'alias' && data[fn].length === 0)
                    return null;
                else
                    return false;
            });
        stmFra.bindValues[':cateID'] = cateID;

        if (DB.exec(
                  'UPDATE `categories` SET ' + stmFra.stm +
                      ' WHERE `id`=:cateID',
                  stmFra.bindValues)
                .ok) {
            JS.emitSignal('updatedCategory', [category(caller, cateID)]);
            return true;
        } else
            return false;
    } else
        return false;
}

function deleteCategory(caller, cateID) {
    var rows = DB.exec('SELECT * FROM `categories` WHERE `id`=:cateID', {
                     ':cateID': cateID
                 }).rows;
    if (rows.length === 0) return false;
    var cID = rows[0].cid;

    if (checkOwn(cID, getCallerToken(caller)) === 1) {
        var result = DB.exec(
            'DELETE FROM `categories` WHERE `id`=:cateID', {':cateID': cateID});

        if (result.ok) {
            JS.emitSignal('deletedCategory', [cateID]);
            DB.exec(
                'DELETE FROM `resources` WHERE `cateid`=:cateID',
                {':cateID': cateID});
        }

        return result.ok;
    } else
        return false;
}

function resources(caller, cID, cateID, all) {
    var token = getCallerToken(caller);
    var hideCond = (all === false ? ' AND `hide`=false' : '');
    var fields = '`id`,`cid`,`cateid`,`title`,`alias`,`desc`,`type`,' +
        '`date`,`mdate`,`seq`,`hide`,`private` ';

    var privateCond =
        '(cpri!=1 AND (catepri!=1 OR catepri ISNULL) AND `private`!=1) ';
    if (token !== null) privateCond = '(' + privateCond + ' OR `own`=:token) ';

    if (cateID === undefined) {
        return DB
            .exec(
                'SELECT ' + fields + 'FROM view_resources WHERE ' +
                    privateCond + 'AND `cid`=:cID' + hideCond,
                {':cID': cID, ':token': token})
            .rows;
    } else {
        return DB
            .exec(
                'SELECT ' + fields + 'FROM view_resources WHERE ' +
                    privateCond + 'AND cid=:cID AND cateid=:cateID' + hideCond,
                {':cID': cID, ':cateID': cateID, ':token': token})
            .rows;
    }
}

function resource(caller, rID) {
    if (typeof rID == 'number') {
        return DB
            .exec(
                'SELECT ' +
                    '`id`,`cid`,`cateid`,`title`,`alias`,' +
                    '`desc`,`type`,`date`,`mdate`,`seq`,`hide`,`private` ' +
                    'FROM `resources` WHERE `id`=:ID',
                {':ID': rID})
            .rows[0];
    } else if (typeof rID == 'string') {
        rID = resIDByPath(rID);
        if (rID != -1)
            return resource(caller, rID);
        else
            return undefined;
    } else
        return undefined;
}

function resourceContent(caller, rID) {
    var token = getCallerToken(caller);

    var privateCond =
        '(cpri!=1 AND (catepri!=1 OR catepri ISNULL) AND `private`!=1) ';
    if (token !== null) privateCond = '(' + privateCond + ' OR `own`=:token) ';

    if (typeof rID == 'number') {
        if (DB.exec(
                  'SELECT count() AS `count` FROM view_resources WHERE ' +
                      privateCond + 'AND id=:rID',
                  {':rID': rID, ':token': token})
                .rows[0]
                .count > 0) {
            var result = DB.exec(
                'SELECT `content` FROM `resources` WHERE `id`=:rID',
                {':rID': rID});

            if (result.rows.length > 0)
                return {id: rID, content: result.rows[0]['content']};
            else
                return {id: -1, content: ''};
        } else
            return {id: -1, content: ''};
    } else if (typeof rID == 'string') {
        rID = resIDByPath(rID);
        if (rID != -1)
            return resourceContent(caller, rID);
        else
            return {id: -1, content: ''};
    } else
        return {id: -1, content: ''};
}

function addResource(caller, cID, res) {
    if (checkOwn(cID, getCallerToken(caller)) === 1) {
        var fields = [
            'cateid', 'title', 'alias', 'desc', 'content', 'seq', 'hide', 'type'
        ];
        var fStm = 'cid';
        var vStm = ':cID';
        var bindValues = {':cID': cID};
        // var first = true;

        if (res !== undefined) {
            for (var x in fields) {
                var fn = fields[x];
                var value = res[fn];
                if (value !== undefined) {
                    fStm += ',';
                    vStm += ','

                    var bFn = ':' + fn;
                    fStm += '`' + fn + '`';
                    vStm += bFn;

                    if (fn === 'alias' && res[fn].length === 0)
                        bindValues[bFn] = null;
                    else
                        bindValues[bFn] = value;
                }
            }
        }

        var result = DB.exec(
            'INSERT INTO `resources` (' + fStm + ') VALUES (' + vStm + ')',
            bindValues);

        if (result.ok) {
            var newRes = resource(caller, result.lastInsert);
            JS.emitSignal('addedResource', [newRes]);
            return true;
        } else
            return false;
    } else
        return false;
}

function updateResource(caller, rID, res) {
    var rows = DB.exec('SELECT * FROM `resources` WHERE `id`=:rID', {
                     ':rID': rID
                 }).rows;
    if (rows.length === 0) return false;
    var cID = rows[0].cid;

    if (checkOwn(cID, getCallerToken(caller)) === 1) {
        var fields = [
            'cateid', 'title', 'alias', 'desc', 'content', 'seq', 'type',
            'hide', 'private'
        ];

        var sStm = '';
        var first = true;
        var bindValues = {};
        bindValues[':rID'] = rID;

        for (let x in fields) {
            let fn = fields[x];
            if (res[fn] !== undefined) {
                if (!first)
                    sStm += ', ';
                else
                    first = false;

                var bFn = ':' + fn;
                sStm += '`' + fn + '`=' + bFn;
                if (fn === 'alias' && res[fn].length === 0)
                    bindValues[bFn] = null;
                else
                    bindValues[bFn] = res[fn];
            }
        }

        if (DB.exec(
                  'UPDATE `resources` SET ' + sStm + ' WHERE `id`=:rID',
                  bindValues)
                .ok) {
            var updatedResource = resource(caller, rID);

            var updatedContent = false;
            var updatedAttr = false;
            for (let x in fields) {
                let fn = fields[x];
                if (fn in res) {
                    if (fn === 'content')
                        updatedContent = true;
                    else
                        updatedAttr = true;
                }
            }
            if (updatedContent)
                JS.emitSignal('updatedContent', [rID, updatedContent]);
            if (updatedAttr)
                JS.emitSignal('updatedResource', [updatedResource]);

            return true;
        } else
            return false;
    } else
        return false;
}

function deleteResource(caller, rID) {
    var rows = DB.exec('SELECT * FROM `resources` WHERE `id`=:rID', {
                     ':rID': rID
                 }).rows;
    if (rows.length === 0) return false;
    var cID = rows[0].cid;

    if (checkOwn(cID, getCallerToken(caller)) === 1) {
        if (DB.exec('DELETE FROM `resources` WHERE `id`=:rID', {
                  ':rID': rID
              }).ok) {
            JS.emitSignal('deletedResource', [rID]);
            return true;
        } else
            return false;
    } else
        return false;
}

