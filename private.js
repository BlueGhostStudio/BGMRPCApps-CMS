function resIDByPath(path) {
    console.log('in private.js');
    var s = path.split('/');

    if (s.length != 3) return -1;

    var coll = s[0];
    var cate = s[1];
    var res = s[2];

    var result = DB.exec(
        'SELECT `id` FROM `collections` WHERE ifnull(`alias`, `title`)=:TITLE',
        {':TITLE': coll});
    if (result.ok && result.rows.length > 0) {
        var cid = result.rows[0]['id'];
        if (cate === '*' || cate.length === 0) {
            result = DB.exec(
                'SELECT `id` FROM `resources` ' +
                    'WHERE `cid`=:CID ' +
                    'AND ifnull(`alias`,`title`)=:TITLE',
                {':CID': cid, ':TITLE': res});
            if (result.ok && result.rows.length > 0)
                return result.rows[0]['id'];
            else
                return -1;
        } else {
            result = DB.exec(
                'SELECT `id` FROM `categories` WHERE `cid`=:CID AND ' +
                    'ifnull(`alias`, `title`)=:TITLE',
                {':CID': cid, ':TITLE': cate});
            if (result.ok && result.rows.length > 0) {
                var cateID = result.rows[0]['id'];
                result = DB.exec(
                    'SELECT `id` FROM `resources` ' +
                        'WHERE `cid`=:CID ' +
                        'AND `cateid`=:CATEID ' +
                        'AND ifnull(`alias`,`title`)=:TITLE',
                    {':CID': cid, ':CATEID': cateID, ':TITLE': res});
                if (result.ok && result.rows.length > 0)
                    return result.rows[0]['id'];
                else
                    return -1;
            } else
                return -1;
        }
    } else
        return -1;
}

function getCallerToken(caller) {
    return JS.call(caller, 'account', 'getToken', [])[0];
}

function checkOwn(cID, token) {
    return DB
        .exec(
            'SELECT count() AS count ' +
                'FROM `collections` ' +
                'WHERE `id`=:ID AND `own`=:T',
            {':ID': cID, ':T': token})
        .rows[0]
        .count;
}
