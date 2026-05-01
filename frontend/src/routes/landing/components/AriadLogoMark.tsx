// 이 파일은 ARIAD 로고 마크를 렌더링합니다.

// 랜딩 페이지에서 사용하는 SVG 로고입니다.
export function AriadLogoMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 128 128">
      <defs>
        <mask id="ariad-logo-thread-cut">
          <rect fill="white" height="128" width="128" />
          <path
            d="M86 29 C77 42 88 51 75 60 C66 67 71 75 63 82"
            fill="none"
            stroke="black"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="11"
          />
        </mask>
      </defs>
      <path
        d="M64 6 L101 56 C111 77 103 106 80 121 C75 124 69 126 64 126 C59 126 53 124 48 121 C25 106 17 77 27 56 Z"
        fill="#101214"
        mask="url(#ariad-logo-thread-cut)"
      />
      <path
        d="M64 6 L101 56 C111 77 103 106 80 121 C75 124 69 126 64 126 C59 126 53 124 48 121 C25 106 17 77 27 56 Z"
        fill="none"
        stroke="#101214"
        strokeLinejoin="round"
        strokeWidth="4"
      />
    </svg>
  );
}
