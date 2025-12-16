# Assets

이 디렉토리에 아이콘 파일이 필요합니다:

- `icon16.png` - 16x16 픽셀
- `icon48.png` - 48x48 픽셀
- `icon128.png` - 128x128 픽셀

## 임시 아이콘 생성 방법

1. 온라인 도구 사용: https://favicon.io/
2. 또는 아래 명령어로 placeholder 생성:

```bash
# ImageMagick 사용
convert -size 16x16 xc:#667eea icon16.png
convert -size 48x48 xc:#667eea icon48.png
convert -size 128x128 xc:#667eea icon128.png
```

## 권장 디자인

- 배경: 그라디언트 (#667eea → #764ba2)
- 아이콘: AI/분석 관련 심볼
- 스타일: 미니멀, 모던
