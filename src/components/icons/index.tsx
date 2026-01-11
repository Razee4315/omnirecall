interface IconProps {
  size?: number;
  className?: string;
}

export function LogoIcon({ size = 32, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={className}
    >
      <path
        d="M65 35L50 50L65 65"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M50 50H70C81.0457 50 90 41.0457 90 30C90 18.9543 81.0457 10 70 10H50C27.9086 10 10 27.9086 10 50C10 72.0914 27.9086 90 50 90C72.0914 90 90 72.0914 90 50"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SearchIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M9 17C13.4183 17 17 13.4183 17 9C17 4.58172 13.4183 1 9 1C4.58172 1 1 4.58172 1 9C1 13.4183 4.58172 17 9 17Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 19L14.65 14.65"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SendIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M18.5 1.5L9 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.5 1.5L12.5 18.5L9 11L1.5 7.5L18.5 1.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SettingsIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.1667 12.5C16.0558 12.7513 16.0227 13.0302 16.0717 13.3005C16.1207 13.5708 16.2496 13.8203 16.4417 14.0167L16.4917 14.0667C16.6467 14.2215 16.7696 14.4053 16.8535 14.6076C16.9374 14.81 16.9806 15.027 16.9806 15.2458C16.9806 15.4647 16.9374 15.6817 16.8535 15.884C16.7696 16.0864 16.6467 16.2702 16.4917 16.425C16.3369 16.58 16.1531 16.7029 15.9507 16.7868C15.7484 16.8707 15.5314 16.9139 15.3125 16.9139C15.0937 16.9139 14.8767 16.8707 14.6743 16.7868C14.472 16.7029 14.2882 16.58 14.1333 16.425L14.0833 16.375C13.887 16.1829 13.6375 16.054 13.3672 16.005C13.0969 15.956 12.818 15.9891 12.5667 16.1C12.3203 16.2056 12.1125 16.3819 11.9687 16.6074C11.825 16.8328 11.7517 17.0973 11.7583 17.3658V17.5C11.7583 17.942 11.5828 18.3659 11.2702 18.6785C10.9577 18.9911 10.5338 19.1667 10.0917 19.1667C9.64966 19.1667 9.22574 18.9911 8.91318 18.6785C8.60062 18.3659 8.425 17.942 8.425 17.5V17.425C8.42545 17.1493 8.34197 16.8797 8.18522 16.6538C8.02847 16.428 7.8061 16.2569 7.55 16.1667C7.29871 16.0558 7.01982 16.0227 6.74951 16.0717C6.4792 16.1207 6.22972 16.2496 6.03333 16.4417L5.98333 16.4917C5.82849 16.6467 5.6447 16.7696 5.44236 16.8535C5.24002 16.9374 5.02299 16.9806 4.80417 16.9806C4.58534 16.9806 4.36831 16.9374 4.16597 16.8535C3.96363 16.7696 3.77984 16.6467 3.625 16.4917C3.46999 16.3369 3.34709 16.1531 3.26319 15.9507C3.17929 15.7484 3.13612 15.5314 3.13612 15.3125C3.13612 15.0937 3.17929 14.8767 3.26319 14.6743C3.34709 14.472 3.46999 14.2882 3.625 14.1333L3.675 14.0833C3.86712 13.887 3.99603 13.6375 4.04502 13.3672C4.09402 13.0969 4.0609 12.818 3.95 12.5667C3.84439 12.3203 3.66812 12.1125 3.44267 11.9687C3.21722 11.825 2.95267 11.7517 2.68417 11.7583H2.5C2.05797 11.7583 1.63405 11.5828 1.32149 11.2702C1.00893 10.9577 0.833333 10.5338 0.833333 10.0917C0.833333 9.64966 1.00893 9.22574 1.32149 8.91318C1.63405 8.60062 2.05797 8.425 2.5 8.425H2.575C2.85073 8.42545 3.12035 8.34197 3.34622 8.18522C3.57208 8.02847 3.74313 7.8061 3.83333 7.55C3.94424 7.29871 3.97735 7.01982 3.92835 6.74951C3.87936 6.4792 3.75045 6.22972 3.55833 6.03333L3.50833 5.98333C3.35333 5.82849 3.23043 5.6447 3.14652 5.44236C3.06262 5.24002 3.01945 5.02299 3.01945 4.80417C3.01945 4.58534 3.06262 4.36831 3.14652 4.16597C3.23043 3.96363 3.35333 3.77984 3.50833 3.625C3.66318 3.46999 3.84696 3.34709 4.0493 3.26319C4.25165 3.17929 4.46867 3.13612 4.6875 3.13612C4.90633 3.13612 5.12335 3.17929 5.3257 3.26319C5.52804 3.34709 5.71183 3.46999 5.86667 3.625L5.91667 3.675C6.11306 3.86712 6.36254 3.99603 6.63285 4.04502C6.90316 4.09402 7.18205 4.0609 7.43333 3.95H7.5C7.74645 3.84439 7.95419 3.66812 8.09795 3.44267C8.24171 3.21722 8.31499 2.95267 8.30833 2.68417V2.5C8.30833 2.05797 8.48393 1.63405 8.79649 1.32149C9.10905 1.00893 9.53297 0.833333 9.975 0.833333C10.417 0.833333 10.841 1.00893 11.1535 1.32149C11.4661 1.63405 11.6417 2.05797 11.6417 2.5V2.575C11.635 2.84349 11.7083 3.10805 11.852 3.33349C11.9958 3.55894 12.2036 3.73522 12.45 3.84083C12.7013 3.95174 12.9802 3.98485 13.2505 3.93586C13.5208 3.88686 13.7703 3.75795 13.9667 3.56583L14.0167 3.51583C14.1715 3.36083 14.3553 3.23793 14.5576 3.15402C14.76 3.07012 14.977 3.02695 15.1958 3.02695C15.4147 3.02695 15.6317 3.07012 15.834 3.15402C16.0364 3.23793 16.2202 3.36083 16.375 3.51583C16.53 3.67068 16.6529 3.85446 16.7368 4.05681C16.8207 4.25915 16.8639 4.47617 16.8639 4.695C16.8639 4.91383 16.8207 5.13085 16.7368 5.3332C16.6529 5.53554 16.53 5.71932 16.375 5.87417L16.325 5.92417C16.1329 6.12056 16.004 6.37004 15.955 6.64035C15.906 6.91066 15.9391 7.18955 16.05 7.44083V7.5C16.1556 7.74645 16.3319 7.95419 16.5573 8.09795C16.7828 8.24171 17.0473 8.31499 17.3158 8.30833H17.5C17.942 8.30833 18.3659 8.48393 18.6785 8.79649C18.9911 9.10905 19.1667 9.53297 19.1667 9.975C19.1667 10.417 18.9911 10.841 18.6785 11.1535C18.3659 11.4661 17.942 11.6417 17.5 11.6417H17.425C17.1565 11.635 16.892 11.7083 16.6665 11.852C16.4411 11.9958 16.2648 12.2036 16.1592 12.45L16.1667 12.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ExpandIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M13 1H19V7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 19H1V13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 1L11 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M1 19L9 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M15 5L5 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 5L15 15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ClipboardIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M13.3333 3.33333H14.1667C14.6087 3.33333 15.0326 3.50893 15.3452 3.82149C15.6577 4.13405 15.8333 4.55797 15.8333 5V16.6667C15.8333 17.1087 15.6577 17.5326 15.3452 17.8452C15.0326 18.1577 14.6087 18.3333 14.1667 18.3333H5.83333C5.39131 18.3333 4.96738 18.1577 4.65482 17.8452C4.34226 17.5326 4.16667 17.1087 4.16667 16.6667V5C4.16667 4.55797 4.34226 4.13405 4.65482 3.82149C4.96738 3.50893 5.39131 3.33333 5.83333 3.33333H6.66667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 1.66667H7.5C7.03976 1.66667 6.66667 2.03977 6.66667 2.50001V4.16667C6.66667 4.62691 7.03976 5.00001 7.5 5.00001H12.5C12.9602 5.00001 13.3333 4.62691 13.3333 4.16667V2.50001C13.3333 2.03977 12.9602 1.66667 12.5 1.66667Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CopyIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M16.6667 7.5H9.16667C8.24619 7.5 7.5 8.24619 7.5 9.16667V16.6667C7.5 17.5871 8.24619 18.3333 9.16667 18.3333H16.6667C17.5871 18.3333 18.3333 17.5871 18.3333 16.6667V9.16667C18.3333 8.24619 17.5871 7.5 16.6667 7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.16667 12.5H3.33333C2.8913 12.5 2.46738 12.3244 2.15482 12.0118C1.84226 11.6993 1.66667 11.2754 1.66667 10.8333V3.33333C1.66667 2.8913 1.84226 2.46738 2.15482 2.15482C2.46738 1.84226 2.8913 1.66667 3.33333 1.66667H10.8333C11.2754 1.66667 11.6993 1.84226 12.0118 2.15482C12.3244 2.46738 12.5 2.8913 12.5 3.33333V4.16667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FolderIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M18.3333 15.8333C18.3333 16.2754 18.1577 16.6993 17.8452 17.0118C17.5326 17.3244 17.1087 17.5 16.6667 17.5H3.33333C2.8913 17.5 2.46738 17.3244 2.15482 17.0118C1.84226 16.6993 1.66667 16.2754 1.66667 15.8333V4.16667C1.66667 3.72464 1.84226 3.30072 2.15482 2.98816C2.46738 2.67559 2.8913 2.5 3.33333 2.5H7.5L9.16667 5H16.6667C17.1087 5 17.5326 5.17559 17.8452 5.48816C18.1577 5.80072 18.3333 6.22464 18.3333 6.66667V15.8333Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlusIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M10 4.16667V15.8333"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4.16667 10H15.8333"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DocumentIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M11.6667 1.66667H5C4.55797 1.66667 4.13405 1.84226 3.82149 2.15482C3.50893 2.46738 3.33333 2.8913 3.33333 3.33333V16.6667C3.33333 17.1087 3.50893 17.5326 3.82149 17.8452C4.13405 18.1577 4.55797 18.3333 5 18.3333H15C15.442 18.3333 15.866 18.1577 16.1785 17.8452C16.4911 17.5326 16.6667 17.1087 16.6667 16.6667V6.66667L11.6667 1.66667Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.6667 1.66667V6.66667H16.6667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.3333 10.8333H6.66667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.3333 14.1667H6.66667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.33333 7.5H7.5H6.66667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronDownIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M5 7.5L10 12.5L15 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StarIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M10 1.66667L12.575 6.88334L18.3333 7.725L14.1667 11.7833L15.15 17.5167L10 14.8083L4.85 17.5167L5.83333 11.7833L1.66667 7.725L7.425 6.88334L10 1.66667Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function RefreshIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M1.66667 3.33333V8.33333H6.66667"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M18.3333 16.6667V11.6667H13.3333"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.325 7.5C15.9357 6.39699 15.2806 5.40667 14.4188 4.61544C13.557 3.82421 12.515 3.25628 11.385 2.96218C10.2549 2.66807 9.07118 2.65688 7.93574 2.92959C6.80029 3.20231 5.74761 3.75039 4.87083 4.525L1.66667 7.5M18.3333 12.5L15.1292 15.475C14.2524 16.2496 13.1997 16.7977 12.0643 17.0704C10.9288 17.3431 9.74512 17.3319 8.61503 17.0378C7.48495 16.7437 6.443 16.1758 5.58121 15.3846C4.71943 14.5933 4.06428 13.603 3.675 12.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThumbsUpIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M5.83333 18.3333H3.33333C2.8913 18.3333 2.46738 18.1577 2.15482 17.8452C1.84226 17.5326 1.66667 17.1087 1.66667 16.6667V10.8333C1.66667 10.3913 1.84226 9.96738 2.15482 9.65482C2.46738 9.34226 2.8913 9.16667 3.33333 9.16667H5.83333M11.6667 7.5V4.16667C11.6667 3.50363 11.4033 2.86774 10.9344 2.3989C10.4656 1.93006 9.82971 1.66667 9.16667 1.66667L5.83333 9.16667V18.3333H15.2333C15.6353 18.3379 16.0253 18.1967 16.3316 17.9363C16.6378 17.6759 16.8397 17.3137 16.9 16.9167L18.05 9.41667C18.0863 9.18418 18.0701 8.94667 18.0026 8.72116C17.9351 8.49565 17.818 8.28773 17.6598 8.11252C17.5015 7.93731 17.3061 7.79926 17.0877 7.70849C16.8694 7.61771 16.6336 7.57639 16.3967 7.5875L11.6667 7.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ThumbsDownIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M14.1667 1.66667H16.6667C17.1087 1.66667 17.5326 1.84226 17.8452 2.15482C18.1577 2.46738 18.3333 2.8913 18.3333 3.33333V9.16667C18.3333 9.6087 18.1577 10.0326 17.8452 10.3452C17.5326 10.6577 17.1087 10.8333 16.6667 10.8333H14.1667M8.33333 12.5V15.8333C8.33333 16.4964 8.59672 17.1323 9.06557 17.6011C9.53441 18.0699 10.1703 18.3333 10.8333 18.3333L14.1667 10.8333V1.66667H4.76667C4.36469 1.66206 3.97468 1.80326 3.66841 2.06368C3.36215 2.3241 3.16027 2.68631 3.1 3.08333L1.95 10.5833C1.91369 10.8158 1.92992 11.0533 1.99738 11.2788C2.06485 11.5044 2.18198 11.7123 2.34022 11.8875C2.49847 12.0627 2.69387 12.2007 2.91223 12.2915C3.13058 12.3823 3.36644 12.4236 3.60333 12.4125L8.33333 12.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MenuIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M2.5 10H17.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 5H17.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 15H17.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SpinnerIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={`animate-spin ${className}`}
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="2"
      />
      <path
        d="M10 2C5.58172 2 2 5.58172 2 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CheckIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M16.6667 5L7.5 14.1667L3.33333 10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AlertIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M10 17.5C14.1421 17.5 17.5 14.1421 17.5 10C17.5 5.85786 14.1421 2.5 10 2.5C5.85786 2.5 2.5 5.85786 2.5 10C2.5 14.1421 5.85786 17.5 10 17.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 6.66667V10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 13.3333H10.0083"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KeyIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M16.6667 1.66667L15 3.33333L16.6667 5L14.1667 7.5L12.5 5.83333L5.83333 12.5C5.41667 12.9167 5.41667 13.75 5.83333 14.1667C6.25 14.5833 7.08333 14.5833 7.5 14.1667L14.1667 7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.83333 14.1667L2.5 17.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.6667 3.33333L16.6667 8.33333"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M0.833333 10C0.833333 10 4.16667 3.33333 10 3.33333C15.8333 3.33333 19.1667 10 19.1667 10C19.1667 10 15.8333 16.6667 10 16.6667C4.16667 16.6667 0.833333 10 0.833333 10Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 12.5C11.3807 12.5 12.5 11.3807 12.5 10C12.5 8.61929 11.3807 7.5 10 7.5C8.61929 7.5 7.5 8.61929 7.5 10C7.5 11.3807 8.61929 12.5 10 12.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeOffIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M11.7667 11.7667C11.5378 12.0123 11.2618 12.2093 10.9551 12.3459C10.6484 12.4826 10.3174 12.556 9.98167 12.5619C9.64594 12.5679 9.31255 12.5063 9.00126 12.3806C8.68997 12.255 8.40722 12.0679 8.16966 11.8303C7.9321 11.5928 7.74502 11.31 7.61935 10.9987C7.49368 10.6875 7.43208 10.3541 7.43804 10.0183C7.444 9.68261 7.51737 9.35157 7.65405 9.04488C7.79072 8.73819 7.98768 8.46221 8.23333 8.23333M14.95 14.95C13.5255 16.0358 11.7909 16.6374 10 16.6667C4.16667 16.6667 0.833333 10 0.833333 10C1.86991 8.06825 3.30762 6.38051 5.05 5.05L14.95 14.95ZM8.25 3.53333C8.82361 3.39907 9.41089 3.33195 10 3.33333C15.8333 3.33333 19.1667 10 19.1667 10C18.6608 10.9463 18.0576 11.8373 17.3667 12.6583L8.25 3.53333Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M0.833333 0.833333L19.1667 19.1667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Typing indicator with animated dots
export function TypingIndicator({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="typing-dot"></span>
      <span className="typing-dot"></span>
      <span className="typing-dot"></span>
    </div>
  );
}

export function BranchIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M5 2.5V10C5 11.3807 6.11929 12.5 7.5 12.5H12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 17.5V15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="5"
        cy="2.5"
        r="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="5"
        cy="17.5"
        r="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle
        cx="15"
        cy="12.5"
        r="1.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function FolderOpenIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M2.5 15.8333L4.16667 8.33333C4.25 7.91667 4.58333 7.5 5 7.5H17.5C18.3333 7.5 18.9167 8.33333 18.6667 9.16667L17.0833 15C16.9167 15.5833 16.4167 16.6667 15.4167 16.6667H4.16667C3.24619 16.6667 2.5 15.9205 2.5 15V15.8333Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 7.5V4.16667C5 3.72464 5.17559 3.30072 5.48816 2.98816C5.80072 2.67559 6.22464 2.5 6.66667 2.5H9.16667L10.8333 5H15.8333C16.2754 5 16.6993 5.17559 17.0118 5.48816C17.3244 5.80072 17.5 6.22464 17.5 6.66667V7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DownloadIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M17.5 12.5V15.8333C17.5 16.2754 17.3244 16.6993 17.0118 17.0118C16.6993 17.3244 16.2754 17.5 15.8333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5.83333 8.33333L10 12.5L14.1667 8.33333"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 12.5V2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function UploadIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M17.5 12.5V15.8333C17.5 16.2754 17.3244 16.6993 17.0118 17.0118C16.6993 17.3244 16.2754 17.5 15.8333 17.5H4.16667C3.72464 17.5 3.30072 17.3244 2.98816 17.0118C2.67559 16.6993 2.5 16.2754 2.5 15.8333V12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14.1667 6.66667L10 2.5L5.83333 6.66667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 2.5V12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StopIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <rect
        x="4"
        y="4"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="currentColor"
      />
    </svg>
  );
}

export function CompareIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M10 2.5V17.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeDasharray="2 2"
      />
      <rect
        x="2.5"
        y="4.5"
        width="5"
        height="11"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <rect
        x="12.5"
        y="4.5"
        width="5"
        height="11"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function CommandIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M5 7.5V5C5 4.33696 5.26339 3.70107 5.73223 3.23223C6.20107 2.76339 6.83696 2.5 7.5 2.5C8.16304 2.5 8.79893 2.76339 9.26777 3.23223C9.73661 3.70107 10 4.33696 10 5V15C10 15.663 10.2634 16.2989 10.7322 16.7678C11.2011 17.2366 11.837 17.5 12.5 17.5C13.163 17.5 13.7989 17.2366 14.2678 16.7678C14.7366 16.2989 15 15.663 15 15V12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 12.5H15C15.663 12.5 16.2989 12.2366 16.7678 11.7678C17.2366 11.2989 17.5 10.663 17.5 10C17.5 9.33696 17.2366 8.70107 16.7678 8.23223C16.2989 7.76339 15.663 7.5 15 7.5H5C4.33696 7.5 3.70107 7.76339 3.23223 8.23223C2.76339 8.70107 2.5 9.33696 2.5 10C2.5 10.663 2.76339 11.2989 3.23223 11.7678C3.70107 12.2366 4.33696 12.5 5 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function HashIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M3.33333 7.5H16.6667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.33333 12.5H16.6667"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8.33333 2.5L6.66667 17.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.3333 2.5L11.6667 17.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronRightIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M7.5 15L12.5 10L7.5 5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrashIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M2.5 5H4.16667H17.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.8333 5V16.6667C15.8333 17.1087 15.6577 17.5326 15.3452 17.8452C15.0326 18.1577 14.6087 18.3333 14.1667 18.3333H5.83333C5.39131 18.3333 4.96738 18.1577 4.65482 17.8452C4.34226 17.5326 4.16667 17.1087 4.16667 16.6667V5M6.66667 5V3.33333C6.66667 2.8913 6.84226 2.46738 7.15482 2.15482C7.46738 1.84226 7.89131 1.66667 8.33333 1.66667H11.6667C12.1087 1.66667 12.5326 1.84226 12.8452 2.15482C13.1577 2.46738 13.3333 2.8913 13.3333 3.33333V5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EditIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M14.1667 2.5C14.3856 2.28113 14.6454 2.10752 14.9314 1.98906C15.2173 1.87061 15.5238 1.80965 15.8333 1.80965C16.1428 1.80965 16.4493 1.87061 16.7353 1.98906C17.0213 2.10752 17.281 2.28113 17.5 2.5C17.7189 2.71887 17.8925 2.97864 18.0109 3.26461C18.1294 3.55057 18.1904 3.85706 18.1904 4.16667C18.1904 4.47627 18.1294 4.78276 18.0109 5.06873C17.8925 5.35469 17.7189 5.61447 17.5 5.83333L6.25 17.0833L1.66667 18.3333L2.91667 13.75L14.1667 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TokenIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <circle
        cx="10"
        cy="10"
        r="7.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10 5V10L13 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MessageIcon({ size = 20, className = "" }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
    >
      <path
        d="M17.5 12.5C17.5 12.942 17.3244 13.366 17.0118 13.6785C16.6993 13.9911 16.2754 14.1667 15.8333 14.1667H5.83333L2.5 17.5V4.16667C2.5 3.72464 2.67559 3.30072 2.98816 2.98816C3.30072 2.67559 3.72464 2.5 3.33333 2.5H15.8333C16.2754 2.5 16.6993 2.67559 17.0118 2.98816C17.3244 3.30072 17.5 3.72464 17.5 4.16667V12.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
