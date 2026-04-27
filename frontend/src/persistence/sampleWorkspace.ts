import type {
  StoryEpisode,
  StoryNode,
  StoryObject,
  StoryWorkspaceSnapshot,
  TemporaryDrawerItem
} from "@ariad/shared";
import type { PersistedEntityKind } from "@ariad/shared";

import { createStableId } from "./stableId";

function nextId(kind: PersistedEntityKind, createId?: (kind: PersistedEntityKind) => string) {
  return createId ? createId(kind) : createStableId(kind);
}

function createEpisode7KoreanComicStructure(
  projectId: string,
  episodeId: string,
  now: string,
  createId?: (kind: PersistedEntityKind) => string
) {
  const deceasedId = nextId("object", createId);
  const sternGuideId = nextId("object", createId);
  const recordsGuideId = nextId("object", createId);
  const funeralHallId = nextId("object", createId);
  const agreementId = nextId("object", createId);

  const nodeIds = {
    bureaucracy: nextId("node", createId),
    callAway: nextId("node", createId),
    consentPressure: nextId("node", createId),
    coerciveRule: nextId("node", createId),
    documentHook: nextId("node", createId),
    escortDuty: nextId("node", createId),
    forcedThreat: nextId("node", createId),
    funeralFrame: nextId("node", createId),
    guideContrast: nextId("node", createId),
    identityConfusion: nextId("node", createId),
    identityRecord: nextId("node", createId),
    livingRitual: nextId("node", createId),
    mythVsPaperwork: nextId("node", createId),
    nextThreshold: nextId("node", createId),
    portraitEvidence: nextId("node", createId),
    proceduralGate: nextId("node", createId),
    recordChecklist: nextId("node", createId),
    refusalBargain: nextId("node", createId),
    reluctantSigning: nextId("node", createId),
    ritualProof: nextId("node", createId),
    scaredSignature: nextId("node", createId),
    signToProceed: nextId("node", createId),
    socialProof: nextId("node", createId),
    visitorBowing: nextId("node", createId),
    waitExplanation: nextId("node", createId)
  };

  const objects: StoryObject[] = [
    {
      category: "person",
      createdAt: now,
      episodeId,
      id: deceasedId,
      name: "김자홍",
      projectId,
      summary: "자신의 죽음을 뒤늦게 받아들이며 저승 절차 안으로 들어가는 평범한 망자.",
      updatedAt: now
    },
    {
      category: "person",
      createdAt: now,
      episodeId,
      id: sternGuideId,
      name: "냉정한 저승차사",
      projectId,
      summary: "감정보다 절차를 앞세워 자홍을 움직이게 만드는 압박형 안내자.",
      updatedAt: now
    },
    {
      category: "person",
      createdAt: now,
      episodeId,
      id: recordsGuideId,
      name: "기록 담당 저승차사",
      projectId,
      summary: "신원을 확인하고 저승 입국 절차를 설명하는 친절한 안내자.",
      updatedAt: now
    },
    {
      category: "place",
      createdAt: now,
      episodeId,
      id: funeralHallId,
      name: "장례식장",
      projectId,
      summary: "산 사람들의 조문이 주인공의 죽음을 확인시키는 첫 경계 공간.",
      updatedAt: now
    },
    {
      category: "thing",
      createdAt: now,
      episodeId,
      id: agreementId,
      name: "저승 입국 동의서",
      projectId,
      summary: "저승 진입을 신화가 아니라 행정 절차처럼 보이게 만드는 핵심 서류.",
      updatedAt: now
    }
  ];

  const nodes: StoryNode[] = [
    {
      canvasX: 62,
      canvasY: 56,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.funeralFrame,
      isCollapsed: false,
      isFixed: false,
      isImportant: true,
      keywords: ["장례식", "죽음 확인", "경계"],
      level: "major",
      objectIds: [deceasedId, funeralHallId],
      orderIndex: 1,
      parentId: null,
      projectId,
      text: "장례식 장면이 주인공의 죽음을 먼저 확정하고, 자홍은 그 사실을 뒤늦게 따라잡는다.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 56,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.socialProof,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["영정", "화환", "조문객"],
      level: "minor",
      objectIds: [deceasedId, funeralHallId],
      orderIndex: 2,
      parentId: nodeIds.funeralFrame,
      projectId,
      text: "영정과 조문객의 존재가 자홍의 죽음을 사회적으로 확인해 주는 증거가 된다.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 56,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.portraitEvidence,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["영정사진", "꽃", "침묵"],
      level: "detail",
      objectIds: [deceasedId, funeralHallId],
      orderIndex: 3,
      parentId: nodeIds.socialProof,
      projectId,
      text: "영정과 꽃, 정적은 한 사람의 삶이 장례식 이미지로 압축됐다는 감각을 준다.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 186,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.livingRitual,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["절", "이별 의식", "거리감"],
      level: "minor",
      objectIds: [deceasedId, funeralHallId],
      orderIndex: 4,
      parentId: nodeIds.funeralFrame,
      projectId,
      text: "산 사람들의 의식은 자홍이 이미 그들과 분리됐다는 사실을 행동으로 보여준다.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 186,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.visitorBowing,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["반복된 절", "실감", "인정"],
      level: "detail",
      objectIds: [deceasedId],
      orderIndex: 5,
      parentId: nodeIds.livingRitual,
      projectId,
      text: "반복되는 조문 동작이 부정을 밀어내고 죽음의 실감을 만든다.",
      updatedAt: now
    },
    {
      canvasX: 62,
      canvasY: 446,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.proceduralGate,
      isCollapsed: false,
      isFixed: false,
      isImportant: true,
      keywords: ["차사 등장", "호출", "인계"],
      level: "major",
      objectIds: [deceasedId, sternGuideId, recordsGuideId],
      orderIndex: 6,
      parentId: null,
      projectId,
      text: "저승차사들이 장례식 공간에 끼어들며 자홍의 다음 이동권을 가져간다.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 446,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.callAway,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["호출", "이동", "권한"],
      level: "minor",
      objectIds: [deceasedId, sternGuideId],
      orderIndex: 7,
      parentId: nodeIds.proceduralGate,
      projectId,
      text: "냉정한 차사는 자홍을 애도 대상이 아니라 처리해야 할 사건처럼 대한다.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 446,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.guideContrast,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["정장", "무덤덤함", "대비"],
      level: "detail",
      objectIds: [sternGuideId, recordsGuideId],
      orderIndex: 8,
      parentId: nodeIds.callAway,
      projectId,
      text: "격식 있는 차림과 사무적인 태도의 대비가 저승의 낯선 질서를 만든다.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 576,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.identityConfusion,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["혼란", "첫 죽음", "설명 요구"],
      level: "minor",
      objectIds: [deceasedId],
      orderIndex: 9,
      parentId: nodeIds.proceduralGate,
      projectId,
      text: "자홍은 죽음이 처음이기 때문에 이동을 늦추고 상황 설명을 요구한다.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 576,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.waitExplanation,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["질문", "불안", "방향 상실"],
      level: "detail",
      objectIds: [deceasedId, recordsGuideId],
      orderIndex: 10,
      parentId: nodeIds.identityConfusion,
      projectId,
      text: "정중한 질문 아래에는 지금 무슨 일이 벌어졌는지 모르는 공포가 깔려 있다.",
      updatedAt: now
    },
    {
      canvasX: 62,
      canvasY: 836,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.bureaucracy,
      isCollapsed: false,
      isFixed: false,
      isImportant: true,
      keywords: ["행정 절차", "신원 확인", "저승 시스템"],
      level: "major",
      objectIds: [deceasedId, recordsGuideId, agreementId],
      orderIndex: 11,
      parentId: null,
      projectId,
      text: "저승은 영적 심판보다 먼저 행정 절차로 소개되며 세계관의 톤을 정한다.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 836,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.identityRecord,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["이름", "생몰 기록", "확인"],
      level: "minor",
      objectIds: [deceasedId, recordsGuideId],
      orderIndex: 12,
      parentId: nodeIds.bureaucracy,
      projectId,
      text: "기록 담당 차사가 자홍의 신원을 확인하며 한 사람의 삶을 서류 항목으로 바꾼다.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 836,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.recordChecklist,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["기록", "출생", "사망"],
      level: "detail",
      objectIds: [deceasedId, recordsGuideId],
      orderIndex: 13,
      parentId: nodeIds.identityRecord,
      projectId,
      text: "생몰 기록 확인은 죽음이 협상 불가능한 공식 상태가 되었음을 보여준다.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 966,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.escortDuty,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["호송", "규칙 설명", "기대 어긋남"],
      level: "minor",
      objectIds: [deceasedId, recordsGuideId, agreementId],
      orderIndex: 14,
      parentId: nodeIds.bureaucracy,
      projectId,
      text: "차사들은 자신들의 역할을 신비한 심판자가 아니라 저승까지 인도하는 담당자로 설명한다.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 966,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.mythVsPaperwork,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["신화", "서류", "코미디"],
      level: "detail",
      objectIds: [deceasedId, agreementId],
      orderIndex: 15,
      parentId: nodeIds.escortDuty,
      projectId,
      text: "저승이라는 신화적 공간을 입국 서류로 처리하면서 코믹한 낯섦이 생긴다.",
      updatedAt: now
    },
    {
      canvasX: 62,
      canvasY: 1226,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.consentPressure,
      isCollapsed: false,
      isFixed: false,
      isImportant: true,
      keywords: ["동의", "압박", "선택지 없음"],
      level: "major",
      objectIds: [deceasedId, sternGuideId, agreementId],
      orderIndex: 16,
      parentId: null,
      projectId,
      text: "동의서는 자발적 선택처럼 보이지만, 곧 거부할 수 없는 절차라는 사실이 드러난다.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 1226,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.refusalBargain,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["부정", "흥정", "생환 가능성"],
      level: "minor",
      objectIds: [deceasedId, agreementId],
      orderIndex: 17,
      parentId: nodeIds.consentPressure,
      projectId,
      text: "자홍은 서명을 거부하면 다시 살아날 수 있는지 물으며 마지막 부정을 시도한다.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 1226,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.ritualProof,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["희망", "부정", "불가능"],
      level: "detail",
      objectIds: [deceasedId],
      orderIndex: 18,
      parentId: nodeIds.refusalBargain,
      projectId,
      text: "질문은 짧은 희망처럼 보이지만, 세계의 규칙은 이미 자홍을 저승 쪽으로 밀고 있다.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 1356,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.coerciveRule,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["강제 집행", "위협", "권력 전환"],
      level: "minor",
      objectIds: [deceasedId, sternGuideId],
      orderIndex: 19,
      parentId: nodeIds.consentPressure,
      projectId,
      text: "냉정한 차사는 거부가 자유가 아니라 강제 집행으로 이어진다는 규칙을 밝힌다.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 1356,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.forcedThreat,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["클로즈업", "압박", "공포"],
      level: "detail",
      objectIds: [sternGuideId],
      orderIndex: 20,
      parentId: nodeIds.coerciveRule,
      projectId,
      text: "차사의 차가운 표정은 친절한 안내가 언제든 강압으로 바뀔 수 있음을 각인시킨다.",
      updatedAt: now
    },
    {
      canvasX: 62,
      canvasY: 1616,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.reluctantSigning,
      isCollapsed: false,
      isFixed: false,
      isImportant: true,
      keywords: ["서명", "두려움", "다음 여정"],
      level: "major",
      objectIds: [deceasedId, agreementId],
      orderIndex: 21,
      parentId: null,
      projectId,
      text: "공포가 결정을 대신하면서 자홍은 서명하고 저승 여정의 다음 단계로 넘어간다.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 1616,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.signToProceed,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["순응", "머쓱함", "생존 본능"],
      level: "minor",
      objectIds: [deceasedId, agreementId],
      orderIndex: 22,
      parentId: nodeIds.reluctantSigning,
      projectId,
      text: "자홍은 알 수 없는 제도에 맞서는 것보다 따르는 편이 안전하다고 판단한다.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 1616,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.scaredSignature,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["쫄림", "수치심", "작아짐"],
      level: "detail",
      objectIds: [deceasedId],
      orderIndex: 23,
      parentId: nodeIds.signToProceed,
      projectId,
      text: "작고 민망한 반응이 거대한 저승 설정을 인간적인 두려움으로 붙잡아 준다.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 1746,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.nextThreshold,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["완료된 서류", "이동 허가", "다음 관문"],
      level: "minor",
      objectIds: [agreementId],
      orderIndex: 24,
      parentId: nodeIds.reluctantSigning,
      projectId,
      text: "완성된 서류는 장면을 닫고 다음 저승 절차를 여는 인계 물건이 된다.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 1746,
      contentMode: "text",
      createdAt: now,
      episodeId,
      id: nodeIds.documentHook,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["서류", "허가", "계속"],
      level: "detail",
      objectIds: [agreementId],
      orderIndex: 25,
      parentId: nodeIds.nextThreshold,
      projectId,
      text: "서명된 동의서는 입장은 허가됐지만 본격적인 심판은 아직 남았다는 후킹 장치다.",
      updatedAt: now
    }
  ];

  return {
    nodes,
    objects
  };
}

export function createSampleWorkspace(
  now: string,
  createId?: (kind: PersistedEntityKind) => string
): StoryWorkspaceSnapshot {
  const projectId = nextId("project", createId);
  const activeEpisodeId = nextId("episode", createId);
  const episode11Id = nextId("episode", createId);
  const episode10Id = nextId("episode", createId);
  const episode9Id = nextId("episode", createId);
  const episode7Id = nextId("episode", createId);
  const objectId = nextId("object", createId);
  const activeNodeId = nextId("node", createId);
  const drawerId = nextId("temporary_drawer", createId);
  const episode7KoreanStructure = createEpisode7KoreanComicStructure(
    projectId,
    episode7Id,
    now,
    createId
  );
  const episode9DeceasedId = nextId("object", createId);
  const episode9SternGuideId = nextId("object", createId);
  const episode9RecordsGuideId = nextId("object", createId);
  const episode9FuneralHallId = nextId("object", createId);
  const episode9AgreementId = nextId("object", createId);

  const episode9NodeIds = {
    bureaucracy: nextId("node", createId),
    callAway: nextId("node", createId),
    consentPressure: nextId("node", createId),
    coerciveRule: nextId("node", createId),
    documentHook: nextId("node", createId),
    escortDuty: nextId("node", createId),
    forcedThreat: nextId("node", createId),
    funeralFrame: nextId("node", createId),
    guideContrast: nextId("node", createId),
    identityConfusion: nextId("node", createId),
    identityRecord: nextId("node", createId),
    livingRitual: nextId("node", createId),
    mythVsPaperwork: nextId("node", createId),
    nextThreshold: nextId("node", createId),
    portraitEvidence: nextId("node", createId),
    proceduralGate: nextId("node", createId),
    recordChecklist: nextId("node", createId),
    refusalBargain: nextId("node", createId),
    reluctantSigning: nextId("node", createId),
    ritualProof: nextId("node", createId),
    scaredSignature: nextId("node", createId),
    signToProceed: nextId("node", createId),
    socialProof: nextId("node", createId),
    visitorBowing: nextId("node", createId),
    waitExplanation: nextId("node", createId)
  };

  const drawerItem: TemporaryDrawerItem = {
    createdAt: now,
    episodeId: activeEpisodeId,
    id: drawerId,
    label: "Unused confrontation beat",
    note: "Hold this in reserve if the mother enters one scene earlier.",
    projectId,
    sourceNodeId: activeNodeId,
    updatedAt: now
  };
  const episode9Objects: StoryObject[] = [
    {
      category: "person",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9DeceasedId,
      name: "Kim Jahong",
      projectId,
      summary: "A recently deceased office worker who enters the afterlife while still confused and afraid.",
      updatedAt: now
    },
    {
      category: "person",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9SternGuideId,
      name: "Stern afterlife guide",
      projectId,
      summary: "A blunt guide who turns confusion into compliance through procedural pressure.",
      updatedAt: now
    },
    {
      category: "person",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9RecordsGuideId,
      name: "Records afterlife guide",
      projectId,
      summary: "A polite guide who verifies identity and explains the entry paperwork.",
      updatedAt: now
    },
    {
      category: "place",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9FuneralHallId,
      name: "Funeral hall",
      projectId,
      summary: "The threshold scene where living-world mourning confirms the protagonist's death.",
      updatedAt: now
    },
    {
      category: "thing",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9AgreementId,
      name: "Afterlife entry agreement",
      projectId,
      summary: "A document that reframes crossing into the afterlife as a bureaucratic obligation.",
      updatedAt: now
    }
  ];
  const episode9Nodes: StoryNode[] = [
    {
      canvasX: 62,
      canvasY: 56,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.funeralFrame,
      isCollapsed: false,
      isFixed: false,
      isImportant: true,
      keywords: ["funeral", "death confirmation", "threshold"],
      level: "major",
      objectIds: [episode9DeceasedId, episode9FuneralHallId],
      orderIndex: 1,
      parentId: null,
      projectId,
      text: "The funeral setting fixes the protagonist's death before he fully understands his new state.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 56,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.socialProof,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["portrait", "wreaths", "mourners"],
      level: "minor",
      objectIds: [episode9DeceasedId, episode9FuneralHallId],
      orderIndex: 2,
      parentId: episode9NodeIds.funeralFrame,
      projectId,
      text: "Memorial visuals and familiar visitors create public proof that the protagonist is dead.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 56,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.portraitEvidence,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["portrait", "flowers", "silence"],
      level: "detail",
      objectIds: [episode9DeceasedId, episode9FuneralHallId],
      orderIndex: 3,
      parentId: episode9NodeIds.socialProof,
      projectId,
      text: "The portrait, flowers, and quiet hall compress a whole life into a single memorial image.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 186,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.livingRitual,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["bowing", "farewell", "separation"],
      level: "minor",
      objectIds: [episode9DeceasedId, episode9FuneralHallId],
      orderIndex: 4,
      parentId: episode9NodeIds.funeralFrame,
      projectId,
      text: "The living perform farewell rituals while the protagonist reads them as proof of separation.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 186,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.visitorBowing,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["two bows", "recognition", "acceptance"],
      level: "detail",
      objectIds: [episode9DeceasedId],
      orderIndex: 5,
      parentId: episode9NodeIds.livingRitual,
      projectId,
      text: "Repeated bows turn denial into a practical realization: the funeral is truly his.",
      updatedAt: now
    },
    {
      canvasX: 62,
      canvasY: 446,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.proceduralGate,
      isCollapsed: false,
      isFixed: false,
      isImportant: true,
      keywords: ["summons", "guides", "handoff"],
      level: "major",
      objectIds: [episode9DeceasedId, episode9SternGuideId, episode9RecordsGuideId],
      orderIndex: 6,
      parentId: null,
      projectId,
      text: "Afterlife guides interrupt the mourning space and claim authority over the next step.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 446,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.callAway,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["summons", "movement", "authority"],
      level: "minor",
      objectIds: [episode9DeceasedId, episode9SternGuideId],
      orderIndex: 7,
      parentId: episode9NodeIds.proceduralGate,
      projectId,
      text: "The stern guide treats the protagonist less like a mourner and more like a case to process.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 446,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.guideContrast,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["formal suit", "casual command", "contrast"],
      level: "detail",
      objectIds: [episode9SternGuideId, episode9RecordsGuideId],
      orderIndex: 8,
      parentId: episode9NodeIds.callAway,
      projectId,
      text: "Their formal appearance clashes with a blunt, worklike attitude toward death.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 576,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.identityConfusion,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["confusion", "first death", "delay"],
      level: "minor",
      objectIds: [episode9DeceasedId],
      orderIndex: 9,
      parentId: episode9NodeIds.proceduralGate,
      projectId,
      text: "The protagonist slows the handoff because dying is new, absurd, and unexplained to him.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 576,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.waitExplanation,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["question", "panic", "orientation"],
      level: "detail",
      objectIds: [episode9DeceasedId, episode9RecordsGuideId],
      orderIndex: 10,
      parentId: episode9NodeIds.identityConfusion,
      projectId,
      text: "His request for explanation exposes panic beneath polite confusion.",
      updatedAt: now
    },
    {
      canvasX: 62,
      canvasY: 836,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.bureaucracy,
      isCollapsed: false,
      isFixed: false,
      isImportant: true,
      keywords: ["paperwork", "identity check", "afterlife system"],
      level: "major",
      objectIds: [episode9DeceasedId, episode9RecordsGuideId, episode9AgreementId],
      orderIndex: 11,
      parentId: null,
      projectId,
      text: "The afterlife is introduced as an administrative system before it becomes a spiritual journey.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 836,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.identityRecord,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["name", "dates", "verification"],
      level: "minor",
      objectIds: [episode9DeceasedId, episode9RecordsGuideId],
      orderIndex: 12,
      parentId: episode9NodeIds.bureaucracy,
      projectId,
      text: "A guide confirms identity through records, reducing a life to verified fields.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 836,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.recordChecklist,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["record", "birth", "death"],
      level: "detail",
      objectIds: [episode9DeceasedId, episode9RecordsGuideId],
      orderIndex: 13,
      parentId: episode9NodeIds.identityRecord,
      projectId,
      text: "The record check makes death feel official, banal, and impossible to negotiate.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 966,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.escortDuty,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["escort", "expectation gap", "rules"],
      level: "minor",
      objectIds: [episode9DeceasedId, episode9RecordsGuideId, episode9AgreementId],
      orderIndex: 14,
      parentId: episode9NodeIds.bureaucracy,
      projectId,
      text: "The guides explain their role as escort duty, not as a mystical judgment yet.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 966,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.mythVsPaperwork,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["myth", "modern form", "comedy"],
      level: "detail",
      objectIds: [episode9DeceasedId, episode9AgreementId],
      orderIndex: 15,
      parentId: episode9NodeIds.escortDuty,
      projectId,
      text: "The comic tension comes from replacing mythic awe with an ordinary form-signing process.",
      updatedAt: now
    },
    {
      canvasX: 62,
      canvasY: 1226,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.consentPressure,
      isCollapsed: false,
      isFixed: false,
      isImportant: true,
      keywords: ["consent", "pressure", "no real choice"],
      level: "major",
      objectIds: [episode9DeceasedId, episode9SternGuideId, episode9AgreementId],
      orderIndex: 16,
      parentId: null,
      projectId,
      text: "The agreement appears voluntary, but the rules quickly reveal that refusal has consequences.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 1226,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.refusalBargain,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["denial", "bargaining", "return to life"],
      level: "minor",
      objectIds: [episode9DeceasedId, episode9AgreementId],
      orderIndex: 17,
      parentId: episode9NodeIds.consentPressure,
      projectId,
      text: "The protagonist tests whether refusing the document could undo his death.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 1226,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.ritualProof,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["bargain", "denial", "false hope"],
      level: "detail",
      objectIds: [episode9DeceasedId],
      orderIndex: 18,
      parentId: episode9NodeIds.refusalBargain,
      projectId,
      text: "The question briefly gives denial a practical shape, even though the system will not allow it.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 1356,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.coerciveRule,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["threat", "forced procedure", "authority"],
      level: "minor",
      objectIds: [episode9DeceasedId, episode9SternGuideId],
      orderIndex: 19,
      parentId: episode9NodeIds.consentPressure,
      projectId,
      text: "The stern guide clarifies that refusal leads to forced handling rather than freedom.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 1356,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.forcedThreat,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["close-up", "intimidation", "power shift"],
      level: "detail",
      objectIds: [episode9SternGuideId],
      orderIndex: 20,
      parentId: episode9NodeIds.coerciveRule,
      projectId,
      text: "The close, severe expression turns polite guidance into visible coercive power.",
      updatedAt: now
    },
    {
      canvasX: 62,
      canvasY: 1616,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.reluctantSigning,
      isCollapsed: false,
      isFixed: false,
      isImportant: true,
      keywords: ["signature", "fear", "next journey"],
      level: "major",
      objectIds: [episode9DeceasedId, episode9AgreementId],
      orderIndex: 21,
      parentId: null,
      projectId,
      text: "Fear resolves the scene: the protagonist signs, and the afterlife journey can begin.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 1616,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.signToProceed,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["compliance", "embarrassment", "survival instinct"],
      level: "minor",
      objectIds: [episode9DeceasedId, episode9AgreementId],
      orderIndex: 22,
      parentId: episode9NodeIds.reluctantSigning,
      projectId,
      text: "He chooses compliance because it feels safer than challenging an unknown system.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 1616,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.scaredSignature,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["shame", "smallness", "reluctance"],
      level: "detail",
      objectIds: [episode9DeceasedId],
      orderIndex: 23,
      parentId: episode9NodeIds.signToProceed,
      projectId,
      text: "His small, embarrassed reaction keeps the supernatural premise grounded in human fear.",
      updatedAt: now
    },
    {
      canvasX: 390,
      canvasY: 1746,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.nextThreshold,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["signed form", "transition", "hook"],
      level: "minor",
      objectIds: [episode9AgreementId],
      orderIndex: 24,
      parentId: episode9NodeIds.reluctantSigning,
      projectId,
      text: "The completed document becomes the scene's handoff object into the next stage.",
      updatedAt: now
    },
    {
      canvasX: 735,
      canvasY: 1746,
      contentMode: "text",
      createdAt: "2026-04-13T07:05:00.000Z",
      episodeId: episode9Id,
      id: episode9NodeIds.documentHook,
      isCollapsed: false,
      isFixed: false,
      isImportant: false,
      keywords: ["paper", "permission", "continuation"],
      level: "detail",
      objectIds: [episode9AgreementId],
      orderIndex: 25,
      parentId: episode9NodeIds.nextThreshold,
      projectId,
      text: "The signed form functions as a visual hook: entry is authorized, but judgment still waits.",
      updatedAt: now
    }
  ];

  return {
    episodes: [
      {
        createdAt: now,
        endpoint: "The heroine's mother tells the male lead to leave.",
        id: activeEpisodeId,
        objective: "Bridge the cafe meeting to the episode-ending ultimatum.",
        projectId,
        title: "Episode 12",
        updatedAt: now
      },
      {
        createdAt: "2026-04-15T10:18:00.000Z",
        endpoint: "The second warning lands before the cafe door closes.",
        id: episode11Id,
        objective: "Tighten the confrontation so the heroine hesitates earlier.",
        projectId,
        title: "Episode 11",
        updatedAt: "2026-04-15T10:18:00.000Z"
      },
      {
        createdAt: "2026-04-14T08:35:00.000Z",
        endpoint: "The neighborhood rumor reaches the heroine first.",
        id: episode10Id,
        objective: "Seed the pressure before the mother steps in directly.",
        projectId,
        title: "Episode 10",
        updatedAt: "2026-04-14T08:35:00.000Z"
      },
      {
        createdAt: "2026-04-13T07:05:00.000Z",
        endpoint: "The deceased reluctantly signs the afterlife entry agreement and is pushed toward the next stage.",
        id: episode9Id,
        objective: "Capture the funeral-to-afterlife handoff as an editable ARIAD node structure.",
        projectId,
        title: "Episode 9",
        updatedAt: now
      },
      {
        createdAt: "2026-04-11T07:05:00.000Z",
        endpoint: "망자가 저승 입국 동의서에 서명하고 다음 절차로 밀려난다.",
        id: episode7Id,
        objective: "제공된 만화 장면을 한국어 ARIAD 구조 노드로 정리한다.",
        projectId,
        title: "Episode 7",
        updatedAt: now
      }
    ],
    nodes: [
      {
        canvasX: 62,
        canvasY: 56,
        contentMode: "keywords",
        createdAt: now,
        episodeId: activeEpisodeId,
        id: activeNodeId,
        isCollapsed: false,
        isFixed: false,
        isImportant: false,
        keywords: ["meeting", "pressure", "hesitation"],
        level: "major",
        objectIds: [objectId],
        orderIndex: 1,
        parentId: null,
        projectId,
        text: "",
        updatedAt: now
      },
      ...episode7KoreanStructure.nodes,
      ...episode9Nodes
    ],
    objects: [
      {
        category: "person",
        createdAt: now,
        episodeId: activeEpisodeId,
        id: objectId,
        name: "Heroine's Mother",
        projectId,
        summary: "An authority figure who sharpens the episode's closing turn.",
        updatedAt: now
      },
      ...episode7KoreanStructure.objects,
      ...episode9Objects
    ],
    project: {
      activeEpisodeId,
      createdAt: now,
      id: projectId,
      summary: "A persistence baseline for a recurring webtoon episode workspace.",
      title: "Weekly Episode Workspace",
      updatedAt: now
    },
    temporaryDrawer: [drawerItem]
  };
}

export function ensureEpisode9ComicStructure(
  snapshot: StoryWorkspaceSnapshot,
  now: string,
  createId?: (kind: PersistedEntityKind) => string
): StoryWorkspaceSnapshot {
  const episode9 = snapshot.episodes.find(
    (episode) => episode.title.trim().toLowerCase() === "episode 9"
  );

  if (!episode9) {
    return snapshot;
  }

  const existingEpisode9Nodes = snapshot.nodes.filter(
    (node) => node.episodeId === episode9.id
  );

  if (existingEpisode9Nodes.length > 0) {
    return snapshot;
  }

  const template = createSampleWorkspace(now, createId);
  const templateEpisode9 = template.episodes.find(
    (episode) => episode.title.trim().toLowerCase() === "episode 9"
  );

  if (!templateEpisode9) {
    return snapshot;
  }

  const timestamp = now;
  const episode9TemplateNodes = template.nodes.filter(
    (node) => node.episodeId === templateEpisode9.id
  );
  const episode9TemplateObjects = template.objects.filter(
    (object) => object.episodeId === templateEpisode9.id
  );

  return {
    ...snapshot,
    episodes: snapshot.episodes.map((episode) =>
      episode.id === episode9.id
        ? {
            ...episode,
            endpoint:
              "The deceased reluctantly signs the afterlife entry agreement and is pushed toward the next stage.",
            objective:
              "Capture the funeral-to-afterlife handoff as an editable ARIAD node structure.",
            updatedAt: timestamp
          }
        : episode
    ),
    nodes: [
      ...snapshot.nodes,
      ...episode9TemplateNodes.map((node) => ({
        ...node,
        episodeId: episode9.id,
        projectId: snapshot.project.id,
        updatedAt: timestamp
      }))
    ],
    objects: [
      ...snapshot.objects,
      ...episode9TemplateObjects.map((object) => ({
        ...object,
        episodeId: episode9.id,
        projectId: snapshot.project.id,
        updatedAt: timestamp
      }))
    ]
  };
}

export function ensureEpisode7KoreanComicStructure(
  snapshot: StoryWorkspaceSnapshot,
  now: string,
  createId?: (kind: PersistedEntityKind) => string
): StoryWorkspaceSnapshot {
  const existingEpisode7 = snapshot.episodes.find(
    (episode) => episode.title.trim().toLowerCase() === "episode 7"
  );
  const episode7Id = existingEpisode7?.id ?? nextId("episode", createId);
  const existingEpisode7Nodes = snapshot.nodes.filter(
    (node) => node.episodeId === episode7Id
  );

  if (existingEpisode7 && existingEpisode7Nodes.length > 0) {
    return snapshot;
  }

  const timestamp = now;
  const koreanStructure = createEpisode7KoreanComicStructure(
    snapshot.project.id,
    episode7Id,
    timestamp,
    createId
  );
  const episode7: StoryEpisode = {
    createdAt: existingEpisode7?.createdAt ?? "2026-04-11T07:05:00.000Z",
    endpoint: "망자가 저승 입국 동의서에 서명하고 다음 절차로 밀려난다.",
    id: episode7Id,
    objective: "제공된 만화 장면을 한국어 ARIAD 구조 노드로 정리한다.",
    projectId: snapshot.project.id,
    title: existingEpisode7?.title ?? "Episode 7",
    updatedAt: timestamp
  };

  return {
    ...snapshot,
    episodes: existingEpisode7
      ? snapshot.episodes.map((episode) =>
          episode.id === episode7Id ? { ...episode, ...episode7 } : episode
        )
      : [...snapshot.episodes, episode7],
    nodes: [
      ...snapshot.nodes.filter((node) => node.episodeId !== episode7Id),
      ...koreanStructure.nodes
    ],
    objects: [
      ...snapshot.objects.filter((object) => object.episodeId !== episode7Id),
      ...koreanStructure.objects
    ]
  };
}
