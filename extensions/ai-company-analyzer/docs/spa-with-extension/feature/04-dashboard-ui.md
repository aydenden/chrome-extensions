# 대시보드 UI 기능 명세

## 1. 개요

SPA의 대시보드 UI 구성 및 기능 명세.

## 2. 페이지 구조

```
[Header]
    │
    ├── 로고 / 홈 링크
    ├── 네비게이션 (회사 목록 / 설정)
    └── 엔진 상태 표시
        │
        ▼
[Main Content]
    │
    ├── /                    → CompanyList
    ├── /company/:id         → CompanyDetail
    ├── /analysis/:id        → Analysis
    └── /settings            → Settings
```

## 3. CompanyList (회사 목록)

### 3.1 와이어프레임

```
┌────────────────────────────────────────────────────────────┐
│ [Header]                                                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  회사 목록                                    [새로고침]    │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ (주)테크스타트│  │ ABC 컴퍼니   │  │ 스타트업X   │     │
│  │              │  │              │  │              │     │
│  │ 📷 5개       │  │ 📷 3개       │  │ 📷 8개       │     │
│  │ ✅ 3개 분석  │  │ ✅ 0개 분석  │  │ ✅ 8개 분석  │     │
│  │              │  │              │  │              │     │
│  │ [상세보기]   │  │ [상세보기]   │  │ [상세보기]   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 3.2 구현

```tsx
// spa/src/pages/CompanyList.tsx
export function CompanyList() {
  const { data: companies, isLoading, refetch } = useCompanies();
  const { isConnected } = useExtension();

  if (!isConnected) {
    return <ExtensionRequired />;
  }

  if (isLoading) {
    return <LoadingSpinner message="회사 목록 불러오는 중..." />;
  }

  if (!companies?.length) {
    return (
      <EmptyState
        icon={Building}
        title="수집된 회사가 없습니다"
        description="원티드나 잡플래닛에서 회사 페이지를 방문하면 자동으로 수집됩니다."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">회사 목록</h1>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          새로고침
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {companies.map((company) => (
          <CompanyCard key={company.id} company={company} />
        ))}
      </div>
    </div>
  );
}
```

### 3.3 CompanyCard 컴포넌트

```tsx
// spa/src/components/company/CompanyCard.tsx
interface CompanyCardProps {
  company: CompanyDTO;
}

export function CompanyCard({ company }: CompanyCardProps) {
  const navigate = useNavigate();

  const progress = company.imageCount > 0
    ? Math.round((company.analyzedCount / company.imageCount) * 100)
    : 0;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="truncate">{company.name}</CardTitle>
        <CardDescription>
          <SiteTypeBadge type={company.siteType} />
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">이미지</span>
            <span>{company.imageCount}개</span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-500">분석 완료</span>
            <span>{company.analyzedCount}개</span>
          </div>

          <div className="mt-4">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1 text-right">
              {progress}% 완료
            </p>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          onClick={() => navigate(`/company/${company.id}`)}
        >
          상세보기
        </Button>
      </CardFooter>
    </Card>
  );
}
```

## 4. CompanyDetail (회사 상세)

### 4.1 와이어프레임

```
┌────────────────────────────────────────────────────────────┐
│ [Header]                                                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ← 뒤로  (주)테크스타트                                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📊 통계                                              │   │
│  │                                                      │   │
│  │ 총 이미지: 5개  |  분석 완료: 3개  |  대기: 2개      │   │
│  │                                                      │   │
│  │ [미분석 이미지 분석하기]                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  이미지 갤러리                                              │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐             │
│  │  썸네일1   │ │  썸네일2   │ │  썸네일3   │             │
│  │            │ │            │ │            │             │
│  │ [매출추이] │ │ [리뷰긍정] │ │ [미분석]   │             │
│  └────────────┘ └────────────┘ └────────────┘             │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 4.2 구현

```tsx
// spa/src/pages/CompanyDetail.tsx
export function CompanyDetail() {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();
  const { data: company, isLoading: companyLoading } = useCompany(companyId!);
  const { data: images, isLoading: imagesLoading } = useImages(companyId!);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (companyLoading || imagesLoading) {
    return <LoadingSpinner />;
  }

  if (!company) {
    return <NotFound message="회사를 찾을 수 없습니다" />;
  }

  const pendingCount = images?.filter((img) => !img.hasAnalysis).length || 0;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-2xl font-bold">{company.name}</h1>
        <SiteTypeBadge type={company.siteType} />
      </div>

      {/* 통계 */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold">{company.imageCount}</p>
              <p className="text-sm text-gray-500">총 이미지</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-green-600">
                {company.analyzedCount}
              </p>
              <p className="text-sm text-gray-500">분석 완료</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-yellow-600">
                {pendingCount}
              </p>
              <p className="text-sm text-gray-500">대기 중</p>
            </div>
          </div>

          {pendingCount > 0 && (
            <Button
              className="w-full mt-6"
              onClick={() => navigate(`/analysis/${companyId}`)}
            >
              미분석 이미지 분석하기 ({pendingCount}개)
            </Button>
          )}
        </CardContent>
      </Card>

      {/* 이미지 갤러리 */}
      <div>
        <h2 className="text-lg font-semibold mb-4">이미지 갤러리</h2>
        <ImageGallery
          images={images || []}
          onSelect={setSelectedImage}
        />
      </div>

      {/* 이미지 상세 모달 */}
      {selectedImage && (
        <ImageDetailModal
          imageId={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </div>
  );
}
```

## 5. Analysis (분석)

### 5.1 와이어프레임

```
┌────────────────────────────────────────────────────────────┐
│ [Header]                                                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  이미지 분석                                                │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 엔진 상태                                            │   │
│  │                                                      │   │
│  │ OCR: ✅ 준비됨                                       │   │
│  │ LLM: ⏳ 로딩 중... (45%)                             │   │
│  │ [████████░░░░░░░░░░░░░░]                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  분석 대상: 5개 이미지                                      │
│                                                             │
│  [분석 시작]                                                │
│                                                             │
│  ─────────────────────────────────────────────────────     │
│                                                             │
│  진행 상황: 2/5 (OCR 처리 중...)                           │
│  [████████░░░░░░░░░░░░░░]                                  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 5.2 진행 상태 컴포넌트

```tsx
// spa/src/components/analysis/AnalysisProgress.tsx
interface AnalysisProgressProps {
  current: number;
  total: number;
  phase: 'ocr' | 'analysis' | 'saving';
  error?: string;
}

const phaseLabels = {
  ocr: 'OCR 처리 중',
  analysis: '분석 중',
  saving: '저장 중',
};

export function AnalysisProgress({
  current,
  total,
  phase,
  error,
}: AnalysisProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">{phaseLabels[phase]}...</span>
            <span className="text-sm text-gray-500">
              {current}/{total}
            </span>
          </div>

          <Progress value={percentage} />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

## 6. Settings (설정)

### 6.1 와이어프레임

```
┌────────────────────────────────────────────────────────────┐
│ [Header]                                                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  설정                                                       │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Extension 연결                                       │   │
│  │                                                      │   │
│  │ 상태: ✅ 연결됨                                      │   │
│  │ Extension ID: abcdef...                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 데이터 관리                                          │   │
│  │                                                      │   │
│  │ 저장 용량: 45.2 MB                                   │   │
│  │ 회사 수: 12개                                        │   │
│  │ 이미지 수: 67개                                      │   │
│  │                                                      │   │
│  │ [캐시 초기화]  [모든 데이터 삭제]                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AI 엔진                                              │   │
│  │                                                      │   │
│  │ OCR Workers: 4개                                     │   │
│  │ LLM 모델: Qwen3-0.6B                                 │   │
│  │ WebGPU: ✅ 지원됨                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 6.2 구현

```tsx
// spa/src/pages/Settings.tsx
export function Settings() {
  const { isConnected } = useExtension();
  const { isReady: ocrReady } = useOCR();
  const { isReady: llmReady } = useLLM();
  const { data: stats } = useStats();

  const [isClearing, setIsClearing] = useState(false);

  const handleClearCache = async () => {
    setIsClearing(true);
    try {
      // React Query 캐시 초기화
      queryClient.clear();
      toast.success('캐시가 초기화되었습니다');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">설정</h1>

      {/* Extension 연결 */}
      <Card>
        <CardHeader>
          <CardTitle>Extension 연결</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <StatusIndicator status={isConnected ? 'success' : 'error'} />
            <span>{isConnected ? '연결됨' : '연결 안됨'}</span>
          </div>
          {!isConnected && (
            <p className="text-sm text-gray-500 mt-2">
              Chrome Extension이 설치되어 있는지 확인하세요.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 데이터 관리 */}
      <Card>
        <CardHeader>
          <CardTitle>데이터 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {stats && (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-lg font-semibold">
                  {formatBytes(stats.storageUsed)}
                </p>
                <p className="text-sm text-gray-500">저장 용량</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{stats.totalCompanies}</p>
                <p className="text-sm text-gray-500">회사</p>
              </div>
              <div>
                <p className="text-lg font-semibold">{stats.totalImages}</p>
                <p className="text-sm text-gray-500">이미지</p>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleClearCache}
              disabled={isClearing}
            >
              캐시 초기화
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* AI 엔진 */}
      <Card>
        <CardHeader>
          <CardTitle>AI 엔진</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span>OCR (Tesseract.js)</span>
            <StatusIndicator status={ocrReady ? 'success' : 'loading'} />
          </div>
          <div className="flex justify-between">
            <span>LLM (Qwen3-0.6B)</span>
            <StatusIndicator status={llmReady ? 'success' : 'loading'} />
          </div>
          <div className="flex justify-between">
            <span>WebGPU</span>
            <StatusIndicator
              status={navigator.gpu ? 'success' : 'error'}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## 7. 공통 컴포넌트

### 7.1 Header

```tsx
// spa/src/components/layout/Header.tsx
export function Header() {
  const { isConnected } = useExtension();
  const { isReady: ocrReady } = useOCR();
  const { isReady: llmReady } = useLLM();

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <Building className="w-6 h-6" />
          <span className="font-bold">AI Company Analyzer</span>
        </Link>

        <nav className="flex items-center gap-4">
          <NavLink to="/">회사 목록</NavLink>
          <NavLink to="/settings">설정</NavLink>

          <div className="flex items-center gap-2 ml-4">
            <EngineStatusDot label="EXT" ready={isConnected} />
            <EngineStatusDot label="OCR" ready={ocrReady} />
            <EngineStatusDot label="LLM" ready={llmReady} />
          </div>
        </nav>
      </div>
    </header>
  );
}

function EngineStatusDot({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center gap-1 text-xs">
      <div
        className={`w-2 h-2 rounded-full ${
          ready ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
        }`}
      />
      <span className="text-gray-500">{label}</span>
    </div>
  );
}
```

## 8. 반응형 디자인

### 8.1 Breakpoints

```css
/* TailwindCSS 기본 breakpoints */
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
```

### 8.2 그리드 레이아웃

```tsx
// 회사 카드 그리드
<div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {companies.map(company => <CompanyCard key={company.id} />)}
</div>

// 이미지 갤러리 그리드
<div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
  {images.map(image => <ImageThumbnail key={image.id} />)}
</div>
```

## 9. 테스트 체크리스트

- [ ] 회사 목록 로드 및 표시
- [ ] 회사 상세 페이지 네비게이션
- [ ] 이미지 갤러리 렌더링
- [ ] 분석 진행 상태 표시
- [ ] 설정 페이지 기능
- [ ] 반응형 레이아웃
- [ ] 로딩 상태 처리
- [ ] 에러 상태 처리
- [ ] Extension 미연결 처리
