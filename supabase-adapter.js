
(function(){
  'use strict';

  if (!window.supabase || !window.supabase.createClient) {
    throw new Error('Supabase 라이브러리를 불러오지 못했습니다.');
  }

  const db = window.supabase.createClient(
    window.GULBI_SUPABASE_URL,
    window.GULBI_SUPABASE_KEY,
    {
      auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false },
      global: { headers: { 'x-client-info':'yeowoobang-gulbi-github-v1' } }
    }
  );

  function normalizeArg(method, arg) {
    if (arg == null) return {};
    if (typeof arg === 'object' && !Array.isArray(arg)) return arg;

    if (method === 'getRoomSnapshot' || method === 'getVoteSummary') {
      return { roomCode:String(arg || '') };
    }
    return { value:arg };
  }

  function shareUrl(roomCode) {
    const base = location.href.split('?')[0].split('#')[0];
    return base + '?room=' + encodeURIComponent(roomCode) + '#room=' + encodeURIComponent(roomCode);
  }

  function postprocess(method, result) {
    if (!result || typeof result !== 'object') return result;

    if (method === 'getRoomSnapshot' && result.roomCode && !result.shareUrl) {
      result.shareUrl = shareUrl(result.roomCode);
    }

    if ((method === 'getRoomList' || method === 'getArchivedRoomList') && Array.isArray(result.items)) {
      result.items.forEach(function(x){
        if (x && x.roomCode && !x.shareUrl) x.shareUrl = shareUrl(x.roomCode);
      });
    }

    if (method === 'createRoom' && result.roomCode && !result.url) {
      result.url = shareUrl(result.roomCode);
    }

    return result;
  }

  async function invoke(method, arg) {
    const payload = normalizeArg(method, arg);

    // 운영진 로그인은 전용 RPC 사용.
    // DB에 @아이디 / 아이디 어느 형태로 저장돼 있어도 동일하게 로그인됩니다.
    if (method === 'adminLogin') {
      const loginId = String(payload.loginId || '').trim();
      const password = String(payload.pin || payload.password || '');
      const { data, error } = await db.rpc('admin_login_v2', {
        p_login_id: loginId,
        p_password: password
      });

      if (error) {
        const msg = error.message || error.details || '운영진 정보가 맞지 않아요.';
        throw new Error(msg.replace(/^.*?ERROR:\s*/i, ''));
      }
      return data;
    }

    // V152.6: 운영진이 참여자의 요청 없이 ACTIVE 링크를 즉시 보관합니다.
    // 현재 모네 운영진 세션(admin_sessions) 토큰을 그대로 사용합니다.
    if (method === 'adminArchiveLinkDirect') {
      const { data, error } = await db.rpc('mone_admin_archive_link_direct_v134', {
        p_token: String(payload.token || '').trim(),
        p_room_code: String(payload.roomCode || '').trim(),
        p_instagram_id: String(payload.instagramId || '').trim()
      });
      if (error) {
        const msg = error.message || error.details || '링크 보관에 실패했어요.';
        throw new Error(msg.replace(/^.*?ERROR:\s*/i, ''));
      }
      return data;
    }

    const { data, error } = await db.rpc('gulbi_api', {
      p_action: method,
      p_payload: payload
    });

    if (error) {
      const msg = error.message || error.details || '서버 요청에 실패했어요.';
      throw new Error(msg.replace(/^.*?ERROR:\s*/i, ''));
    }

    return postprocess(method, data);
  }

  function runner(success, failure) {
    const state = { success:success || null, failure:failure || null };

    const target = {
      withSuccessHandler(fn) { return runner(fn, state.failure); },
      withFailureHandler(fn) { return runner(state.success, fn); }
    };

    return new Proxy(target, {
      get(obj, prop) {
        if (prop in obj) return obj[prop];
        if (typeof prop !== 'string') return undefined;

        return function(arg) {
          invoke(prop, arg)
            .then(function(res){
              if (state.success) state.success(res);
            })
            .catch(function(err){
              if (state.failure) state.failure(err);
              else console.error('[gulbi]', prop, err);
            });
          return runner(state.success, state.failure);
        };
      }
    });
  }

  window.gulbiSupabase = { db:db, invoke:invoke };
  window.google = window.google || {};
  window.google.script = window.google.script || {};
  Object.defineProperty(window.google.script, 'run', {
    configurable:true,
    get:function(){ return runner(null, null); }
  });
})();
