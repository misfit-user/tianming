import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js',(s,r)=>{
  s=r(s,'      if (opts.onDone) opts.onDone(txt);',`      if (opts._recoveryStream) {
        var recovery = globalThis.TM && globalThis.TM.Endturn && globalThis.TM.Endturn.ResponseRecovery;
        opts._recoveryStream.complete = !!recovery && recovery.jsonComplete(data);
        opts._recoveryStream.tier = _aiCfg.tier || opts.tier || 'primary';
      }
      if (opts.onDone) opts.onDone(txt);`);
  s=r(s,"    var full = '';","    var full = '';\n    var recoveryComplete = false, recoveryInvalid = false;");
  s=r(s,"        if (payload === '[DONE]') continue;","        if (payload === '[DONE]') { recoveryComplete = true; continue; }");
  s=r(s,'          var chunk = JSON.parse(payload);',`          var chunk = JSON.parse(payload);
          var finishReason = chunk.choices && chunk.choices[0] && chunk.choices[0].finish_reason;
          if (finishReason === 'stop') recoveryComplete = true;
          else if (finishReason) recoveryInvalid = true;
          if (chunk.error || chunk.choices && chunk.choices[0] && chunk.choices[0].delta && chunk.choices[0].delta.refusal) recoveryInvalid = true;`);
  s=r(s,'        } catch (_e) { /* ignore malformed chunks */ }','        } catch (_e) { recoveryInvalid = true; /* Existing partial-output handling is unchanged; never checkpoint malformed streams. */ }');
  return r(s,'    if (opts.onDone) opts.onDone(full);',`    if (opts._recoveryStream) {
      opts._recoveryStream.complete = recoveryComplete && !recoveryInvalid && !buffer.trim();
      opts._recoveryStream.tier = _aiCfg.tier || opts.tier || 'primary';
    }
    if (opts.onDone) opts.onDone(full);`);
});
edit('web/tm-endturn-response-recovery.js',(s,r)=>{
  s=r(s,'var receipt = {}, next = Object.assign({}, opts, { _recoveryStream: receipt });',"var receipt = {}, next = Object.assign({}, opts, { _recoveryStream: receipt });\n    var expectedTier = typeof root._getAITier === 'function' ? (root._getAITier(opts.tier) || {}).tier : opts.tier;\n    expectedTier = expectedTier || opts.tier || 'primary';");
  return r(s,"return receipt.complete === true && typeof v === 'string'","return receipt.complete === true && receipt.tier === expectedTier && typeof v === 'string'");
});
