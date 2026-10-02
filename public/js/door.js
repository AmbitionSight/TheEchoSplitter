// 门状态机：asleep → pulsing → whispered → ritual → opening → opened（规格 §3.1/§4）
export function createDoor() {
  return { state: 'asleep', dropped: false };
}

export function doorEvent(door, ev, arg) {
  switch (ev) {
    case 'WORDS_COMPLETE':
      if (door.state === 'asleep' && arg >= 5) { door.state = 'pulsing'; return { entered: true }; }
      return null;
    case 'CLICK':
      if (door.state === 'pulsing') {
        door.state = 'whispered';
        const drop = !door.dropped;
        door.dropped = true;
        return { whisper: true, ...(drop ? { dropOpenStones: true } : {}) };
      }
      if (door.state === 'whispered' || door.state === 'ritual') return { whisper: true };
      return null;
    case 'OFFER':
      if (door.state === 'whispered' && arg === 'open') { door.state = 'ritual'; return { ritual: true }; }
      return { mutter: true };
    case 'RITUAL_DONE':
      if (door.state === 'ritual') { door.state = 'opening'; return { opening: true }; }
      return null;
    case 'OPEN_DONE':
      if (door.state === 'opening') { door.state = 'opened'; return { opened: true }; }
      return null;
    default:
      return null;
  }
}
