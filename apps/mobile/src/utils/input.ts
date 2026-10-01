/** 아이디용 입력 필터. 서버 규칙과 같게 영문 소문자·숫자·_ 만 허용하고 대문자는 소문자로 바꾼다 */
export const filterUserId = (input: string): string => {
  return input.toLowerCase().replace(/[^a-z0-9_]/g, '');
};
