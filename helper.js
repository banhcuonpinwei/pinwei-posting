/*
 * The posting helper: New post (composer), Groups this week (copy-and-open queue), Check D+1, Check D+3.
 * One API call ("bootstrap") loads every tab; switching tabs never reloads. The composer keeps what you
 * typed when its data is refreshed.
 */
(function () {
  'use strict';
  var esc = PW.esc;
  var $ = function (id) { return document.getElementById(id); };
  var TABS = ['compose', 'week', 'd1', 'd3'];
  var state = { data: null, editing: null, img: null, removeImage: false, armed: null, queuePlan: '', composeBuilt: false };

  // ------------------------------------------------------------ frame

  function tabFromHash() {
    var t = String(location.hash).replace(/^#/, '');
    return TABS.indexOf(t) >= 0 ? t : 'compose';
  }

  function showTab() {
    var tab = tabFromHash();
    TABS.forEach(function (t) { $('t-' + t).hidden = t !== tab; });
    Array.prototype.forEach.call($('tabs').querySelectorAll('a'), function (a) {
      a.className = a.getAttribute('data-tab') === tab ? 'on' : '';
    });
  }

  function showError(err) {
    if (err && err.auth) {
      $('error').innerHTML = PW.noKeyHtml();
      return;
    }
    $('error').innerHTML = '<p class="note bad">' + esc(err && err.message || err) + ' <a href="#" id="retry">Try again</a></p>';
    $('retry').addEventListener('click', function (ev) { ev.preventDefault(); load(); });
  }

  function footer(r) {
    var at = new Date();
    $('foot').innerHTML = 'Updated ' + at.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) +
      ' · loaded in ' + (r.total_ms / 1000).toFixed(1) + ' s (server ' + (r.server_ms / 1000).toFixed(1) + ' s) · ' +
      '<a href="#" id="refresh">Refresh</a> · <a href="install.html">Capture bookmark</a>';
    $('refresh').addEventListener('click', function (ev) { ev.preventDefault(); load(); });
  }

  function load() {
    $('error').innerHTML = '';
    return PW.api('bootstrap', { plan: state.queuePlan }).then(function (r) {
      state.data = r.data;
      footer(r);
      renderCompose();
      renderWeek();
      renderD1();
      renderD3();
    }, showError);
  }

  // ------------------------------------------------------------ New post

  function hint(ch) {
    var reason = state.data.meta[ch];
    if (ch === 'Page') return reason ? reason + ' Set up the Meta app to post for real.' : 'Posts on the Page right away.';
    return (reason ? reason + ' ' : 'Posts right away. ') + 'Needs a photo (JPEG, between 4:5 and 1.91:1).';
  }

  function buildCompose() {
    $('t-compose').innerHTML =
      '<div class="compose-grid"><section class="card composer">' +
      '<h2 class="card-title"><span id="cTitle">Create post</span> <a href="#" id="cNew" class="small" hidden>Start a new post</a></h2>' +
      '<p id="cStatus" class="note warn" hidden></p>' +
      '<textarea id="text" class="postbox" placeholder="What do you want to tell customers?"></textarea>' +
      '<div class="muted small" id="count"></div>' +
      '<div id="photo" class="photo" hidden><img id="preview" alt=""><button type="button" class="alt" id="removePhoto">Remove photo</button></div>' +
      '<div class="row"><label class="btn alt" for="file">Add photo</label><input type="file" id="file" accept="image/*" hidden>' +
      '<span class="muted small" id="photoNote"></span></div>' +
      '<div class="pair"><div><label for="topic">Name (for you)</label><input type="text" id="topic" maxlength="120" placeholder="e.g. Morning bánh cuốn"></div>' +
      '<div><label for="branch">Branch</label><select id="branch"><option>All</option><option>TD</option><option>BT</option><option>LM</option></select></div></div>' +
      '<label>Post to</label><div class="targets">' +
      '<label class="check"><input type="checkbox" id="page"> <span><b>Facebook Page</b><br><span class="muted small" id="hPage"></span></span></label>' +
      '<label class="check"><input type="checkbox" id="ig"> <span><b>Instagram</b><br><span class="muted small" id="hIG"></span></span></label>' +
      '<label class="check"><input type="checkbox" id="group" checked> <span><b>Facebook groups</b><br><span class="muted small" id="hGroup"></span></span></label></div>' +
      '<div class="bar"><label for="who">Posted by</label><input type="text" id="who" maxlength="60" placeholder="Your name"></div>' +
      '<div class="actions"><button type="button" class="alt" id="save">Save draft</button> <button type="button" id="post">Post</button></div>' +
      '<div id="result" class="result"></div></section>' +
      '<section class="card recent"><h2 class="card-title">Recent posts</h2><div id="recent"></div></section></div>';
    PW.remember('pw_posted_by', $('who'));
    $('text').addEventListener('input', count);
    $('ig').addEventListener('change', count);
    $('file').addEventListener('change', pickPhoto);
    $('removePhoto').addEventListener('click', function () {
      state.img = null;
      state.removeImage = true;
      $('photo').hidden = true;
      $('photoNote').textContent = '';
    });
    $('cNew').addEventListener('click', function (ev) { ev.preventDefault(); edit(null); });
    $('save').addEventListener('click', save);
    $('post').addEventListener('click', post);
    state.composeBuilt = true;
    count();
  }

  function count() {
    var n = $('text').value.length;
    var ig = $('ig').checked;
    $('count').textContent = n + ' characters' + (ig ? ' · Instagram max 2,200' : '');
    $('count').className = 'muted small' + (ig && n > 2200 ? ' badc' : '');
  }

  function pickPhoto() {
    var f = this.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      var im = new Image();
      im.onload = function () {
        var s = Math.min(1, 1440 / Math.max(im.width, im.height));
        var c = document.createElement('canvas');
        c.width = Math.round(im.width * s);
        c.height = Math.round(im.height * s);
        var g = c.getContext('2d');
        g.fillStyle = '#fff';
        g.fillRect(0, 0, c.width, c.height);
        g.drawImage(im, 0, 0, c.width, c.height);
        var url = c.toDataURL('image/jpeg', 0.9);
        state.img = { base64: url.split(',')[1], mime: 'image/jpeg', name: (f.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg' };
        state.removeImage = false;
        $('preview').src = url;
        $('photo').hidden = false;
        var ratio = c.width / c.height;
        $('photoNote').textContent = ratio < 0.8 || ratio > 1.91 ? 'Instagram only takes photos between 4:5 (tall) and 1.91:1 (wide); this one is outside.' : '';
      };
      im.src = reader.result;
    };
    reader.readAsDataURL(f);
    this.value = '';
  }

  /** Loads a post into the composer (null = a new post). */
  function edit(plan) {
    state.editing = plan;
    state.img = null;
    state.removeImage = false;
    $('cTitle').textContent = plan ? 'Edit post ' + plan.plan_id : 'Create post';
    $('cNew').hidden = !plan;
    $('cStatus').hidden = !plan || plan.status === 'Draft';
    $('cStatus').textContent = plan ? 'Status ' + plan.status + '. Post only sends what was not posted yet.' : '';
    $('text').value = plan ? plan.text : '';
    $('topic').value = plan ? plan.topic : '';
    $('branch').value = plan ? plan.branch : 'All';
    $('page').checked = plan ? plan.channels.indexOf('page') >= 0 : false;
    $('ig').checked = plan ? plan.channels.indexOf('ig') >= 0 : false;
    $('group').checked = plan ? plan.channels.indexOf('group') >= 0 : true;
    if (plan && plan.image_file_id) {
      $('preview').src = 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(plan.image_file_id) + '&sz=w800';
      $('photo').hidden = false;
    } else {
      $('photo').hidden = true;
    }
    $('photoNote').textContent = '';
    $('result').innerHTML = '';
    count();
    window.scrollTo(0, 0);
  }

  function renderCompose() {
    if (!state.composeBuilt) buildCompose();
    var d = state.data;
    $('hPage').textContent = hint('Page');
    $('hIG').textContent = hint('IG');
    $('hGroup').textContent = d.groups_due + ' group' + (d.groups_due === 1 ? '' : 's') +
      ' due this week. You post them one by one from the queue (Facebook has no API for groups).';
    if (!d.recent.length) {
      $('recent').innerHTML = '<p class="muted">Nothing yet.</p>';
      return;
    }
    $('recent').innerHTML = '<table class="list"><tbody>' + d.recent.map(function (x, i) {
      var links = ['<a href="#" data-open="' + i + '">Open</a>'];
      if (x.status === 'Approved' && x.channels.indexOf('group') >= 0) links.push('<a href="#" data-queue="' + esc(x.plan_id) + '">Group queue</a>');
      return '<tr><td><b>' + esc(x.topic || x.plan_id) + '</b><div class="muted small">' + esc(x.plan_id) + ' · ' +
        esc(x.channels.map(function (c) { return { page: 'Page', ig: 'IG', group: 'Group' }[c] || c; }).join(', ') || '-') +
        '</div></td><td><span class="tag st-' + esc(String(x.status).toLowerCase()) + '">' + esc(x.status) + '</span></td><td>' + links.join(' · ') + '</td></tr>';
    }).join('') + '</tbody></table>';
    Array.prototype.forEach.call($('recent').querySelectorAll('a[data-open]'), function (a) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); edit(state.data.recent[Number(a.getAttribute('data-open'))]); });
    });
    Array.prototype.forEach.call($('recent').querySelectorAll('a[data-queue]'), function (a) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); openQueue(a.getAttribute('data-queue')); });
    });
    // Keep the post being edited in step with what the server now has.
    if (state.editing) {
      var now = d.recent.filter(function (x) { return x.plan_id === state.editing.plan_id; })[0];
      if (now) {
        state.editing = now;
        $('cStatus').hidden = now.status === 'Draft';
        $('cStatus').textContent = 'Status ' + now.status + '. Post only sends what was not posted yet.';
      }
    }
  }

  function form() {
    return {
      plan_id: state.editing ? state.editing.plan_id : '',
      text: $('text').value, topic: $('topic').value, branch: $('branch').value,
      page: $('page').checked, ig: $('ig').checked, group: $('group').checked,
      posted_by: $('who').value, image: state.img, remove_image: state.removeImage,
    };
  }

  function result(html, cls) {
    $('result').className = 'result ' + (cls || '');
    $('result').innerHTML = html;
  }

  function busy(on) {
    $('save').disabled = on;
    $('post').disabled = on;
  }

  function afterWrite(planId) {
    state.img = null;
    state.removeImage = false;
    state.editing = { plan_id: planId, status: 'Draft' };
    $('cTitle').textContent = 'Edit post ' + planId;
    $('cNew').hidden = false;
    return load();
  }

  function save() {
    busy(true);
    result('Saving…');
    PW.api('composeSave', form()).then(function (r) {
      busy(false);
      result(esc(r.data.message), 'okc');
      afterWrite(r.data.plan_id);
    }, function (err) {
      busy(false);
      result('Not saved: ' + esc(err.message), 'badc');
    });
  }

  function post() {
    var b = $('post');
    if (!state.armed) {
      var where = [$('page').checked ? 'Facebook Page' : '', $('ig').checked ? 'Instagram' : '', $('group').checked ? 'the group queue' : '']
        .filter(Boolean).join(', ');
      b.textContent = 'Click again to post to ' + (where || '…');
      state.armed = setTimeout(function () { state.armed = null; b.textContent = 'Post'; }, 5000);
      return;
    }
    clearTimeout(state.armed);
    state.armed = null;
    b.textContent = 'Post';
    busy(true);
    result('Posting…');
    var groups = $('group').checked;
    PW.api('composePost', form()).then(function (r) {
      busy(false);
      var res = r.data.results;
      var names = { Page: 'Facebook Page', IG: 'Instagram' };
      var lines = Object.keys(res).map(function (ch) {
        var x = res[ch];
        return '<div><b>' + names[ch] + ':</b> ' + esc(x.message) +
          (x.link ? ' <a href="' + esc(x.link) + '" target="_blank" rel="noopener">Open post</a>' : '') + '</div>';
      });
      if (groups) lines.push('<div><b>Facebook groups:</b> <a href="#" id="goQueue">Open the group queue</a></div>');
      var failed = Object.keys(res).some(function (c) { return res[c].status === 'failed'; });
      result(lines.join('') || 'Saved.', failed ? 'badc' : 'okc');
      if (groups) {
        $('goQueue').addEventListener('click', function (ev) { ev.preventDefault(); openQueue(r.data.plan_id); });
        state.queuePlan = r.data.plan_id;
      }
      afterWrite(r.data.plan_id);
    }, function (err) {
      busy(false);
      result('Not posted: ' + esc(err.message), 'badc');
    });
  }

  // ------------------------------------------------------------ Groups this week

  function openQueue(planId) {
    state.queuePlan = planId;
    location.hash = '#week';
    loadQueue();
  }

  function loadQueue() {
    $('t-week').innerHTML = '<p class="muted">Loading…</p>';
    PW.api('queue', { plan: state.queuePlan }).then(function (r) {
      state.data.queue = r.data;
      renderWeek();
    }, showError);
  }

  function renderWeek() {
    var q = state.data.queue;
    var out = ['<p class="muted">Week ' + esc(q.week) + '. For each group: change a few words so no two groups get the same text, click ' +
      '<b>Copy &amp; open</b>, paste in the group\'s post box, add the photo, post. Then Save here (the post link is optional).</p>'];
    if (!q.plans.length) {
      out.push('<p class="note warn">No post for groups this week yet. Write one in New post and tick Facebook groups.</p>');
    } else {
      out.push('<div class="plans">' + q.plans.map(function (x) {
        return '<a href="#" data-plan="' + esc(x.plan_id) + '" class="' + (x.plan_id === q.plan_id ? 'on' : '') + '">' + esc(x.label) + '</a>';
      }).join('') + '</div>');
    }
    out.push('<div class="bar"><label for="qwho">Posted by</label><input type="text" id="qwho" maxlength="60" placeholder="Your name"></div>');
    if (!q.groups_total) {
      out.push('<p class="note warn">The Groups sheet is empty. In the spreadsheet, run Pin Wei Posting &gt; Import groups from the P5 tracker.</p>');
    } else {
      out.push('<p><b>' + q.groups.length + '</b> group' + (q.groups.length === 1 ? '' : 's') + ' to post in this week.' +
        (q.photo_url ? ' Photo for this post: <a href="' + esc(q.photo_url) + '" target="_blank" rel="noopener">Download photo</a>.' : '') + '</p>');
      if (q.groups.length) {
        out.push('<table class="list queue"><thead><tr><th>Group</th><th>Text for this group</th><th>After posting</th></tr></thead><tbody>' +
          q.groups.map(function (g, i) {
            return '<tr data-i="' + i + '"><td data-th="Group"><a href="' + esc(g.url) + '" target="_blank" rel="noopener">' + esc(g.name) + '</a>' +
              (g.unclear ? ' <span class="tag">Unclear</span>' : '') +
              '<div class="muted small">' + PW.members(g.members) + ' members · last post ' + esc(g.last_ago) + ' · this week ' + g.posted + ' / ' + g.max + '</div>' +
              (g.admin_note ? '<div class="muted small">' + esc(g.admin_note) + '</div>' : '') + '</td>' +
              '<td data-th="Text"><textarea class="txt" rows="4">' + esc(g.text) + '</textarea>' +
              '<button type="button" class="copy">Copy &amp; open</button><div class="cmsg small"></div></td>' +
              '<td data-th="After posting"><input type="url" class="link" placeholder="Post link (optional)">' +
              '<select class="st"><option>Posted</option><option>Pending approval</option></select>' +
              '<button type="button" class="save">Save</button><div class="msg small"></div></td></tr>';
          }).join('') + '</tbody></table>');
      }
    }
    $('t-week').innerHTML = out.join('');
    PW.remember('pw_posted_by', $('qwho'));
    Array.prototype.forEach.call($('t-week').querySelectorAll('a[data-plan]'), function (a) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); state.queuePlan = a.getAttribute('data-plan'); loadQueue(); });
    });
    Array.prototype.forEach.call($('t-week').querySelectorAll('tr[data-i]'), function (tr) {
      var g = q.groups[Number(tr.getAttribute('data-i'))];
      var say = function (sel, text, cls) { var el = tr.querySelector(sel); el.className = sel.slice(1) + ' small ' + (cls || ''); el.textContent = text; };
      tr.querySelector('.copy').addEventListener('click', function () {
        var t = tr.querySelector('.txt').value;
        if (!t.trim()) return say('.cmsg', 'Write the text first.', 'badc');
        PW.copy(t, function (ok) {
          say('.cmsg', ok ? 'Copied. In the group: click the post box, Ctrl+V, add the photo, post.' : 'Could not copy: select the text and press Ctrl+C.', ok ? 'okc' : 'badc');
        });
        window.open(g.url, '_blank', 'noopener');
      });
      tr.querySelector('.save').addEventListener('click', function () {
        var who = $('qwho').value.trim();
        if (!who) return say('.msg', 'Type your name in Posted by first.', 'badc');
        var b = this;
        b.disabled = true;
        say('.msg', 'Saving…');
        PW.api('queueSave', {
          group_id: g.group_id, plan_id: q.plan_id, draft_id: g.draft_id, url: tr.querySelector('.link').value,
          status: tr.querySelector('.st').value, posted_by: who, text: tr.querySelector('.txt').value,
        }).then(function (r) {
          say('.msg', r.data.message, 'okc');
          tr.classList.add('done');
          Array.prototype.forEach.call(tr.querySelectorAll('input,select,button.save'), function (x) { x.disabled = true; });
        }, function (err) {
          say('.msg', 'Not saved: ' + err.message, 'badc');
          b.disabled = false;
        });
      });
    });
  }

  // ------------------------------------------------------------ Check D+1 / D+3

  function postLink(p) {
    if (p.post_url) return '<a href="' + esc(p.post_url) + '" target="_blank" rel="noopener">Open post</a>';
    return p.group_url ? '<a href="' + esc(p.group_url) + '" target="_blank" rel="noopener">Open group</a><div class="muted small">No post link saved</div>' : '-';
  }

  function renderD1() {
    var d = state.data.d1;
    var out = ['<p class="muted">Posts made ' + d.days + ' day' + (d.days === 1 ? '' : 's') + ' ago or more. Open each one and say what you see.</p>'];
    if (!d.posts.length) out.push('<p class="note ok">Nothing to check.</p>');
    else {
      out.push('<table class="list"><thead><tr><th>Group</th><th>Posted</th><th>Status now</th><th>Post</th><th>What you see</th></tr></thead><tbody>' +
        d.posts.map(function (p, i) {
          return '<tr data-i="' + i + '"><td data-th="Group">' + esc(p.group_name) + '</td><td data-th="Posted">' + esc(p.posted_ago) +
            (p.posted_by ? ' · ' + esc(p.posted_by) : '') + '</td><td data-th="Status now">' + esc(p.status) + '</td><td data-th="Post">' + postLink(p) + '</td>' +
            '<td><button type="button" data-status="live">Live</button> <button type="button" class="alt" data-status="pending">Still pending</button> ' +
            '<button type="button" class="alt" data-status="removed">Removed</button><div class="msg small"></div></td></tr>';
        }).join('') + '</tbody></table>');
    }
    $('t-d1').innerHTML = out.join('');
    Array.prototype.forEach.call($('t-d1').querySelectorAll('tr[data-i]'), function (tr) {
      var p = d.posts[Number(tr.getAttribute('data-i'))];
      var buttons = tr.querySelectorAll('button');
      var msg = tr.querySelector('.msg');
      Array.prototype.forEach.call(buttons, function (b) {
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(buttons, function (x) { x.disabled = true; });
          msg.className = 'msg small';
          msg.textContent = 'Saving…';
          PW.api('statusSet', { post_id: p.post_id, status: b.getAttribute('data-status') }).then(function (r) {
            msg.className = 'msg small okc';
            msg.textContent = r.data.message;
            tr.classList.add('done');
          }, function (err) {
            msg.className = 'msg small badc';
            msg.textContent = 'Not saved: ' + err.message;
            Array.prototype.forEach.call(buttons, function (x) { x.disabled = false; });
          });
        });
      });
    });
  }

  function renderD3() {
    var d = state.data.d3;
    var out = ['<p class="muted">Live posts made ' + d.days + ' days ago or more. Open the post, press F5, click <b>PW capture</b>, ' +
      'check the numbers and Save. The post leaves this list once its numbers are saved.</p>'];
    if (!d.posts.length) out.push('<p class="note ok">Nothing to record.</p>');
    else {
      out.push('<table class="list"><thead><tr><th>Group</th><th>Posted</th><th>Last numbers</th><th>Post</th></tr></thead><tbody>' +
        d.posts.map(function (p) {
          var last = p.reactions === null && p.comments === null ? 'none yet'
            : (p.reactions === null ? '-' : p.reactions) + ' reactions, ' + (p.comments === null ? '-' : p.comments) + ' comments';
          return '<tr><td data-th="Group">' + esc(p.group_name) + '</td><td data-th="Posted">' + esc(p.posted_ago) + '</td>' +
            '<td data-th="Last numbers">' + esc(last) + '</td><td data-th="Post">' + postLink(p) + '</td></tr>';
        }).join('') + '</tbody></table>');
    }
    $('t-d3').innerHTML = out.join('');
  }

  // ------------------------------------------------------------ start

  window.addEventListener('hashchange', showTab);
  if (!PW.token()) {
    $('t-compose').innerHTML = PW.noKeyHtml();
    return;
  }
  showTab();
  load();
})();
