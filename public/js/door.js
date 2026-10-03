// 门状态机 v2：closed → ritual → opening → opened（开关说出 open 并掉石；门吃 open 词具开门）
export function createDoor() {
  return { state: 'closed' };
}

export function doorEvent(door, ev, arg) {
  switch (ev) {
    case 'OFFER':
      if (door.state === 'closed' && arg === 'open') { door.state = 'ritual'; return { ritual: true }; }
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

// —— 咏亮仪式（规格 §3.1 节拍 12）：四石绕拱依次落座 ——
export const RITUAL_STEP = 0.55;   // 每颗石头的落座间隔（秒）
export function ritualSeats(n = 4) {
  // 拱门四周座位：左柱下 → 左拱肩 → 右拱肩 → 右柱下（门在北墙右端，柱下座位落在墙脚地板）
  return [[1054, 314], [1084, 186], [1140, 186], [1170, 314]].slice(0, n);
}
