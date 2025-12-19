# **브라우저 기반 고성능 Qwen3-VL 추론을 위한 클라이언트 사이드 오케스트레이션 및 최적화 전략**

## **1\. 서론: 로컬 AI와 클라이언트 중심 아키텍처의 부상**

인공지능(AI), 특히 대규모 멀티모달 모델(LMM, Large Multimodal Models)의 발전은 웹 애플리케이션 아키텍처의 근본적인 패러다임 전환을 요구하고 있다. 과거의 웹 애플리케이션은 브라우저가 단순히 사용자 인터페이스(UI)를 렌더링하고, 복잡한 연산이나 데이터 처리는 Node.js나 Python 기반의 중앙 집중식 서버로 위임하는 '씬 클라이언트(Thin Client)' 모델을 따랐다. 그러나 Qwen3-VL과 같은 고성능 비전-언어 모델(VLM)의 등장과 이를 로컬 환경에서 구동할 수 있게 해주는 Ollama와 같은 추론 서버의 성숙은 '데이터가 있는 곳에서 연산을 수행한다'는 엣지 컴퓨팅의 원칙을 브라우저 환경으로 확장시키고 있다.

사용자가 제기한 핵심 과제는 Node.js와 같은 중간 미들웨어를 제거하고, 브라우저가 직접 로컬의 Ollama 서버(Qwen3-VL 탑재)와 통신하는 '브라우저-투-로컬(Browser-to-Local)' 아키텍처를 구현하는 것이다. 이는 단순히 API 엔드포인트를 호출하는 문제를 넘어선다. VLM 추론은 텍스트 기반의 LLM(Large Language Model)과는 본질적으로 다른 데이터 처리 요구사항을 가진다. 고해상도 이미지는 막대한 페이로드 크기를 가지며, 모델의 아키텍처가 요구하는 해상도(Resolution)와 패치(Patch) 구조에 맞게 전처리가 이루어져야만 추론 성능과 정확도를 보장할 수 있다.

본 보고서는 이러한 배경 하에, 브라우저 환경에서 Qwen3-VL 모델을 대상으로 Ollama에 HTTP 요청을 수행할 때 발생할 수 있는 병목 현상을 분석하고, 이를 해결하기 위한 포괄적인 최적화 전략을 제시한다. 특히 보안 정책인 CORS(Cross-Origin Resource Sharing)의 구성부터, 자바스크립트의 단일 스레드(Single-threaded) 한계를 극복하기 위한 Web Workers 및 OffscreenCanvas 활용, 그리고 데이터 전송 효율을 극대화하기 위한 스마트 리사이징(Smart Resizing) 알고리즘과 스트리밍 기법까지 심층적으로 다룬다.

## **2\. 실행 환경 및 아키텍처 제약 사항 분석**

최적화 전략을 수립하기 위해서는 먼저 세 가지 핵심 구성 요소인 브라우저 런타임, Ollama 추론 서버, 그리고 Qwen3-VL 모델의 아키텍처적 특성과 제약 사항을 명확히 이해해야 한다.

### **2.1 브라우저 런타임의 보안 및 성능 제약**

현대적인 웹 브라우저는 보안을 위해 철저히 격리된 샌드박스(Sandbox) 환경에서 동작한다. 이는 로컬 시스템 리소스에 대한 직접적인 접근을 차단하며, 네트워크 요청에 대해서도 엄격한 정책을 적용한다.

* **단일 스레드 이벤트 루프(Event Loop):** 자바스크립트의 메인 스레드는 UI 렌더링, 사용자 입력 처리, 스크립트 실행을 모두 담당한다. 만약 12메가픽셀(MP) 해상도의 이미지를 Base64로 인코딩하거나 캔버스에서 리사이징하는 작업을 메인 스레드에서 수행할 경우, 수백 밀리초(ms) 동안 프레임 드롭(Jank)이 발생하여 사용자 경험을 심각하게 저해한다. 따라서 무거운 연산 작업은 반드시 메인 스레드와 분리되어야 한다.1  
* **동일 출처 정책(SOP) 및 CORS:** 브라우저는 기본적으로 스크립트가 로드된 도메인과 다른 도메인(또는 포트)으로의 리소스 요청을 차단한다. 웹 애플리케이션이 http://localhost:3000에서 실행 중이고 Ollama가 http://localhost:11434에서 실행 중이라면, 이는 서로 다른 출처(Origin)로 간주되어 CORS 위반 오류를 발생시킨다. 이는 브라우저가 로컬 네트워크의 취약한 서비스를 스캔하는 공격을 방지하기 위한 필수적인 보안 메커니즘이다.  
* **메모리 관리:** V8과 같은 자바스크립트 엔진은 메모리 할당에 제한이 있다. 고해상도 이미지의 바이너리 데이터와 이를 인코딩한 거대한 문자열을 동시에 메모리에 유지하는 것은 힙(Heap) 메모리 부족을 유발하거나 가비지 컬렉터(GC)의 빈번한 실행을 초래하여 성능을 저하시킬 수 있다.

### **2.2 Ollama API의 전송 프로토콜 특성**

Ollama는 로컬 LLM 구동을 위한 표준화된 REST API를 제공하지만, 웹 브라우저와의 직접 통신을 고려할 때 몇 가지 특이점이 존재한다.

* **JSON 중심의 데이터 전송:** Ollama의 /api/chat 엔드포인트는 기본적으로 JSON 포맷을 사용한다. 이는 바이너리 데이터(이미지)를 직접 전송할 수 없음을 의미하며, 반드시 Base64 문자열로 인코딩하여 JSON 필드에 포함해야 한다. Base64 인코딩은 원본 바이너리 대비 약 33%의 데이터 크기 증가를 유발하며, 이는 전송 대역폭뿐만 아니라 인코딩/디코딩에 소요되는 CPU 자원을 증가시킨다.2  
* **연결 수명 주기(Keep-Alive):** Ollama는 효율적인 VRAM 관리를 위해 기본적으로 마지막 요청 후 5분이 지나면 모델을 메모리에서 해제(Unload)한다. 사용자가 이미지 분석 결과를 읽고 다음 질문을 하기까지 5분 이상 소요될 경우, 다음 요청 시 모델을 다시 로드하는 '콜드 스타트(Cold Start)' 지연 시간이 발생한다.4

### **2.3 Qwen3-VL 모델의 시각적 처리 아키텍처**

Qwen3-VL은 기존 모델들과 달리 'Naive Dynamic Resolution'이라는 독특한 이미지 처리 방식을 채택하고 있다. 이는 이미지를 고정된 해상도(예: 224x224)로 강제 변환하는 대신, 원본 해상도를 유지하면서 이를 일정한 크기의 '패치(Patch)'로 분할하여 처리하는 방식이다.5

* **패치 기반 토큰화:** Qwen3-VL은 이미지를 14x14 또는 16x16 픽셀 크기의 패치 그리드로 나눈다. 이미지의 해상도가 높아질수록 패치의 개수가 증가하고, 이는 곧 모델이 처리해야 할 '비전 토큰(Vision Tokens)'의 수로 직결된다. 토큰 수가 증가하면 추론에 필요한 VRAM 사용량과 연산 시간이 기하급수적으로 늘어난다.  
* **그리드 정렬 요구사항:** 모델의 내부 처리를 위해 입력 이미지의 너비와 높이는 반드시 특정 수(28 또는 32)의 배수여야 한다. 만약 이 조건을 만족하지 않는 이미지를 전송할 경우, 서버 측에서 패딩(Padding)이나 리사이징을 수행해야 하며, 이는 불필요한 연산 오버헤드와 최적화되지 않은 토큰 생성을 유발한다.7

## **3\. 네트워크 보안 및 전송 계층 최적화**

브라우저에서 Ollama로의 직접적인 통신 채널을 구축하기 위해서는 가장 먼저 네트워크 보안 정책을 올바르게 구성해야 한다. 이는 단순히 연결을 허용하는 것을 넘어, 보안 위협을 최소화하면서도 개발 편의성을 보장하는 방향으로 설계되어야 한다.

### **3.1 CORS(Cross-Origin Resource Sharing) 구성 전략**

Node.js 프록시 서버를 제거함에 따라 브라우저는 Ollama 서버와 직접 HTTP 핸드셰이크를 수행해야 한다. 이 과정에서 발생하는 CORS 문제를 해결하기 위해 Ollama는 OLLAMA\_ORIGINS 환경 변수를 제공한다.

#### **3.1.1 프리플라이트(Preflight) 요청의 이해와 구성**

브라우저는 fetch 요청을 보내기 전에 OPTIONS 메서드를 사용하여 서버에 '이 요청을 보내도 안전한지' 묻는 프리플라이트 요청을 전송한다. Ollama 서버는 이에 대해 적절한 Access-Control-Allow-Origin 헤더로 응답해야 한다.

* **환경 변수 설정:** Ollama 실행 시 OLLAMA\_ORIGINS 변수를 설정하여 허용할 출처를 명시해야 한다.  
  * **개발 환경:** OLLAMA\_ORIGINS="\*" 설정은 모든 출처에서의 요청을 허용한다. 이는 개발 단계에서는 편리하지만, 사용자의 로컬 모델이 악성 웹사이트에 의해 도용될 수 있는 보안 위험을 내포한다.9  
  * **운영 환경:** 실제 배포 시에는 반드시 신뢰할 수 있는 도메인만을 명시해야 한다. 예: OLLAMA\_ORIGINS="https://app.example.com,http://localhost:3000".  
* **운영체제별 적용 방법:**  
  * **macOS:** macOS의 GUI 애플리케이션으로 실행되는 Ollama는 셸 환경 변수를 상속받지 않는다. 따라서 launchctl setenv OLLAMA\_ORIGINS "\*" 명령어를 사용하여 시스템 레벨에서 변수를 설정하고 Ollama를 재시작해야 한다.10  
  * **Linux/Systemd:** systemctl edit ollama.service 명령을 통해 서비스 설정 파일의 \`\` 섹션에 Environment="OLLAMA\_ORIGINS=\*"를 추가해야 한다.11

### **3.2 연결 지속성(Keep-Alive) 및 세션 관리**

VLM 기반 애플리케이션의 사용자 경험(UX)을 결정짓는 중요한 요소는 '첫 토큰 생성 시간(TTFT, Time To First Token)'이다. 모델 로딩 시간은 TTFT의 가장 큰 비중을 차지한다.

#### **3.2.1 동적 Keep-Alive 제어**

Ollama의 기본 설정인 5분의 유휴 시간(Idle Timeout)은 대화형 애플리케이션에 적합하지 않을 수 있다. 사용자가 이미지를 분석하고 긴 시간을 들여 결과를 검토하는 동안 모델이 메모리에서 해제될 수 있기 때문이다.

* **클라이언트 주도적 생명주기 관리:** 브라우저 애플리케이션은 사용자의 세션 상태를 추적하여 API 요청 시 keep\_alive 파라미터를 동적으로 조절해야 한다.  
  * **활성 세션 유지:** 사용자가 채팅 화면에 머물러 있는 동안에는 요청 본문에 keep\_alive: \-1 (무한대) 또는 keep\_alive: "60m"와 같이 긴 시간을 설정하여 모델이 VRAM에서 해제되지 않도록 강제한다.4  
  * **자원 회수:** 사용자가 탭을 닫거나 애플리케이션을 종료할 때(window.onbeforeunload 이벤트), keep\_alive: 0을 포함한 요청을 보내(Beacon API 활용) 즉시 모델을 언로드하고 사용자의 시스템 자원을 반환해야 한다.12 이는 로컬 리소스를 점유하는 애플리케이션으로서 갖춰야 할 중요한 '디지털 에티켓'이다.

## **4\. Qwen3-VL의 연산 아키텍처와 시각적 데이터 최적화**

네트워크 채널이 확보되었다면, 다음 단계는 전송할 데이터(이미지)를 최적화하는 것이다. 이는 단순히 파일 크기를 줄이는 것이 아니라, Qwen3-VL 모델이 세상을 '보는' 방식에 맞춰 데이터를 재구성하는 과정이다.

### **4.1 비전 트랜스포머(ViT)와 패치 그리드 정렬**

Qwen3-VL은 이미지를 픽셀 단위가 아닌 패치 단위로 처리한다. Qwen2.5-VL은 14x14 패치를 사용했으나, Qwen3-VL에 대한 최신 기술 보고 및 이슈 트래커에 따르면 16x16 패치 구조로의 전환이나, 2x2 풀링을 고려한 32 픽셀 단위의 정렬이 권장되고 있다.13

* **그리드 불일치의 비용:** 만약 클라이언트가 1000x1000 픽셀의 이미지를 전송한다고 가정하자. 패치 크기가 14일 때, 1000은 14로 나누어떨어지지 않는다. 서버(Ollama/Qwen)는 이를 처리하기 위해 패딩(Padding)을 추가하거나 이미지를 강제로 리사이징해야 한다. 이 과정에서 원본 정보가 왜곡되거나, 불필요한 '패딩 토큰'이 생성되어 추론 연산량을 증가시킨다.  
* **최적화된 해상도 전략:** 클라이언트는 서버로 이미지를 보내기 전에, 이미지의 너비와 높이가 모델의 패치 크기(28 또는 32)의 배수가 되도록 '스마트 리사이징'을 수행해야 한다. 연구 결과에 따르면, **32의 배수**로 맞추는 것이 Qwen3-VL 및 잠재적인 Qwen2.5-VL 백엔드와의 호환성(32는 16의 배수이며, 28과는 공배수 관계를 고려해야 함) 측면에서 가장 안전하고 효율적인 전략이다. 예를 들어, 1000 픽셀은 32의 배수인 992 또는 1024로 변환되어야 한다.

### **4.2 토큰 경제학과 해상도 제한**

VLM에서 입력 이미지의 해상도는 곧 비용(메모리 및 연산량)이다. 토큰 수는 이미지 해상도에 비례하여 증가한다.

$$\\text{Token Count} \\approx \\left( \\frac{\\text{Height}}{\\text{Patch Size}} \\right) \\times \\left( \\frac{\\text{Width}}{\\text{Patch Size}} \\right)$$

스마트폰으로 촬영한 4K 이미지(3840x2160)를 그대로 전송할 경우, 수만 개의 비전 토큰이 생성된다. 그러나 Qwen3-VL의 성능 분석에 따르면, 약 1280x1280 수준의 해상도(약 100만 픽셀)로도 대부분의 OCR 및 객체 인식 작업에서 최상의 성능을 발휘한다.5 따라서 클라이언트는 max\_pixels 제한(예: 1,003,520 픽셀)을 두어, 이를 초과하는 이미지는 축소하여 전송해야 한다. 이는 전송 대역폭을 절약할 뿐만 아니라, 서버의 VRAM 부족(OOM) 오류를 방지하고 추론 속도를 획기적으로 향상시킨다.

## **5\. 클라이언트 사이드 전처리 파이프라인**

Qwen3-VL에 최적화된 이미지를 생성하기 위해서는 브라우저 내에서 정교한 이미지 처리 파이프라인이 필요하다. 이 과정에서 메인 스레드의 부하를 최소화하는 것이 핵심이다.

### **5.1 Web Workers를 이용한 병렬 처리 아키텍처**

이미지 리사이징과 인코딩은 CPU 집약적인 작업이다. 이를 메인 스레드에서 수행하면 UI가 멈추는 현상이 발생한다. 이를 해결하기 위해 Web Worker를 사용하여 백그라운드 스레드에서 이미지 처리를 수행해야 한다.1

* **데이터 전송 최적화 (Transferable Objects):** 메인 스레드에서 선택된 File 객체를 Worker로 보낼 때, 데이터를 복사하는 대신 소유권을 이전하는 Transferable Objects 패턴(예: ImageBitmap)을 사용해야 한다. 이는 메모리 복사 비용을 제거하여 대용량 이미지 처리 시 오버헤드를 최소화한다.

### **5.2 OffscreenCanvas를 활용한 스마트 리사이징**

기존의 DOM 기반 \<canvas\> 요소는 메인 스레드에 종속되어 있었다. 반면 OffscreenCanvas API는 Worker 스레드 내에서 GPU 가속을 활용한 이미지 렌더링을 가능하게 한다.15

#### **5.2.1 스마트 리사이징 알고리즘 구현**

Worker 내부에서는 다음과 같은 로직으로 이미지를 처리해야 한다:

1. **입력:** 원본 이미지 비트맵, 목표 min\_pixels (예: 256*28*28), max\_pixels (예: 1280*28*28), 패치 단위 P (32).  
2. **스케일링 계수 계산:** 원본의 종횡비를 유지하면서 면적(픽셀 수)이 min과 max 사이에 들어오도록 스케일링 계수 $S$를 계산한다.  
3. 그리드 스냅(Grid Snapping): 계산된 너비와 높이를 각각 $P$의 배수로 반올림한다.

   $$W\_{target} \= \\text{Math.round}(W\_{orig} \\times S / P) \\times P$$  
   $$H\_{target} \= \\text{Math.round}(H\_{orig} \\times S / P) \\times P$$  
4. **렌더링:** OffscreenCanvas를 생성하고 drawImage를 통해 이미지를 리사이징한다. 이때 imageSmoothingQuality: 'high' 옵션을 사용하여 텍스트나 세밀한 디테일의 손실을 방지해야 한다.17

### **5.3 포맷 변환 및 압축**

Qwen3-VL은 JPEG 압축 아티팩트에 비교적 강인하다. 무손실 포맷인 PNG 대신 JPEG(품질 0.85\~0.9)를 사용하면 육안으로 구별하기 힘든 품질 저하만으로 파일 크기를 1/10 수준으로 줄일 수 있다. OffscreenCanvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 }) 메서드를 사용하여 Worker 내에서 직접 압축된 바이너리 데이터를 생성한다.

## **6\. 데이터 직렬화 및 페이로드 최적화**

Ollama API의 JSON/Base64 제약 사항을 극복하기 위한 직렬화 전략이 필요하다.

### **6.1 Base64 오버헤드 관리**

바이너리 데이터를 Base64 문자열로 변환하면 크기가 약 33% 증가한다. 10MB 이미지는 13.3MB의 문자열이 된다. V8 엔진에서 거대한 문자열은 가비지 컬렉션의 주요 부하 원인이 된다.

* **최적화의 연쇄 효과:** 앞서 수행한 '스마트 리사이징'과 'JPEG 압축'은 Base64 오버헤드 문제를 근본적으로 완화한다. 12MP(4000x3000) PNG 이미지가 20MB라면, 리사이징(1280x960) 및 JPEG 압축 후에는 약 300KB가 된다. 300KB의 이미지를 Base64로 변환하는 것은 브라우저에 거의 부하를 주지 않으며, 네트워크 전송 시간도 획기적으로 단축된다.

### **6.2 바이너리 전송의 가능성 (Multipart/Form-Data)**

현재 Ollama의 공식 API 문서와 커뮤니티의 분석에 따르면, /api/chat 엔드포인트는 multipart/form-data를 통한 직접적인 바이너리 업로드를 명시적으로 지원하지 않는 것으로 파악된다.18 일부 커뮤니티 래퍼나 프록시가 이를 지원할 수 있으나, 순수한 Ollama 인스턴스와 통신할 때는 Base64 방식이 유일한 표준이다. 따라서 클라이언트 측에서의 압축 및 리사이징이 선택이 아닌 필수 사항이 된다.

## **7\. 실시간 상호작용 및 스트리밍 구현**

Qwen3-VL은 이미지를 분석하여 긴 텍스트 설명이나 구조화된 데이터를 생성할 수 있다. 사용자가 빈 화면을 보며 기다리지 않도록 스트리밍(Streaming) 응답을 처리해야 한다.

### **7.1 Fetch API와 ReadableStream**

Ollama는 NDJSON(Newline Delimited JSON) 포맷으로 응답을 스트리밍한다. 브라우저의 fetch API는 ReadableStream을 통해 데이터가 도착하는 즉시 처리를 가능하게 한다.20

#### **7.1.2 텍스트 디코딩 및 버퍼링 전략**

스트리밍 데이터를 처리할 때 가장 주의해야 할 점은 UTF-8 멀티바이트 문자의 처리다. 한글이나 이모지 같은 문자는 여러 바이트로 구성되는데, 네트워크 패킷이 이 바이트 중간에서 끊겨 도착할 수 있다. 단순히 바이트 청크를 문자열로 변환하면 '깨진 문자()'가 발생할 수 있다.

* **TextDecoder 스트림 모드:** TextDecoder의 { stream: true } 옵션을 사용해야 한다. 이 옵션은 디코더가 불완전한 바이트 시퀀스를 내부 버퍼에 보관했다가, 다음 청크가 도착하여 완전한 문자가 되었을 때 디코딩하도록 보장한다.

JavaScript

// 스트리밍 디코딩 예시  
const decoder \= new TextDecoder('utf-8');  
const reader \= response.body.getReader();

while (true) {  
  const { done, value } \= await reader.read();  
  if (done) break;  
  // stream: true 옵션이 불완전한 한글 바이트 처리를 보장함  
  const chunk \= decoder.decode(value, { stream: true });  
  // NDJSON 파싱 및 UI 업데이트 로직 수행  
}

## **8\. 종합 아키텍처 비교 및 결론**

지금까지 논의한 최적화 전략을 종합하여, 기존의 단순 접근 방식(Naive Approach)과 제안하는 최적화 아키텍처를 비교하면 다음과 같다.

| 기능적 요소 | 단순 접근 방식 (Naive) | 최적화된 아키텍처 (Optimized) |
| :---- | :---- | :---- |
| **통신 경로** | 브라우저 → Node.js 프록시 → Ollama | **브라우저 → Ollama (직접 통신)** |
| **보안 구성** | 서버 간 통신 (CORS 불필요) | **OLLAMA\_ORIGINS 환경 변수 설정** |
| **이미지 해상도** | 원본 해상도 (예: 4000x3000) | **스마트 리사이징 (32 배수 정렬, 예: 1024x768)** |
| **이미지 포맷** | PNG (무손실, 대용량) | **JPEG (품질 0.85, 고효율)** |
| **처리 스레드** | 메인 UI 스레드 (화면 멈춤 발생) | **Web Worker \+ OffscreenCanvas (UI 영향 없음)** |
| **데이터 페이로드** | 원본의 Base64 (수십 MB) | **최적화된 이미지의 Base64 (수백 KB)** |
| **모델 수명** | 기본 5분 타임아웃 | **세션 기반 keep\_alive 동적 제어** |
| **응답 처리** | 전체 응답 대기 (높은 체감 지연) | **스트리밍 토큰 렌더링 (즉각적 피드백)** |

### **결론 및 제언**

브라우저 환경에서 Node.js 없이 Ollama(Qwen3-VL)를 효율적으로 활용하기 위해서는 '서버가 해야 할 일을 클라이언트가 대신한다'는 두꺼운 클라이언트(Thick Client) 철학을 받아들여야 한다.

1. **네트워크 계층**에서는 OLLAMA\_ORIGINS를 통해 보안 샌드박스를 열고, keep\_alive를 통해 모델의 메모리 상주 시간을 제어하여 UX를 개선해야 한다.  
2. **데이터 계층**에서는 Qwen3-VL 모델의 아키텍처적 특성(패치 기반 처리)을 이해하고, Web Worker와 OffscreenCanvas를 활용하여 클라이언트 리소스를 최대한 활용해 이미지를 전처리(리사이징 및 압축)해야 한다. 이는 네트워크 대역폭을 절약할 뿐만 아니라, 서버의 연산 부하를 획기적으로 줄여 전체 시스템의 처리량을 높인다.  
3. **사용자 경험 계층**에서는 스트리밍 API와 적절한 디코딩 전략을 통해 AI의 응답성을 극대화해야 한다.

이러한 최적화 전략을 통해 개발자는 별도의 백엔드 인프라 없이도, 사용자의 로컬 하드웨어를 최대한 활용하는 고성능의 프라이버시 중심 AI 웹 애플리케이션을 구축할 수 있다. 이는 클라우드 비용을 절감하고, 데이터 주권을 사용자에게 돌려주는 차세대 웹 AI 애플리케이션의 표준 아키텍처가 될 것이다.

#### **참고 자료**

1. How to Prevent JavaScript Lag Using Web Workers \- Procedure Technologies, 12월 19, 2025에 액세스, [https://procedure.tech/blogs/how-to-prevent-javascript-lag-using-web-workers](https://procedure.tech/blogs/how-to-prevent-javascript-lag-using-web-workers)  
2. Why You Should Avoid Base64 for Image Conversion in APIs | by Sandeep Kella \- Medium, 12월 19, 2025에 액세스, [https://medium.com/@sandeepkella23/why-you-should-avoid-base64-for-image-conversion-in-apis-c8d77830bfd8](https://medium.com/@sandeepkella23/why-you-should-avoid-base64-for-image-conversion-in-apis-c8d77830bfd8)  
3. Page Speed: Avoid Large Base64 data URLs in HTML and CSS \- DebugBear, 12월 19, 2025에 액세스, [https://www.debugbear.com/blog/base64-data-urls-html-css](https://www.debugbear.com/blog/base64-data-urls-html-css)  
4. How to Speed Up Ollama Performance \- Database Mart, 12월 19, 2025에 액세스, [https://www.databasemart.com/kb/how-to-speed-up-ollama-performance](https://www.databasemart.com/kb/how-to-speed-up-ollama-performance)  
5. Qwen2-VL: Enhancing Vision-Language Model's Perception of the World at Any Resolution, 12월 19, 2025에 액세스, [https://arxiv.org/html/2409.12191v1](https://arxiv.org/html/2409.12191v1)  
6. Qwen2.5-VL: A hands on code walkthrough | by tangbasky \- Towards AI, 12월 19, 2025에 액세스, [https://pub.towardsai.net/qwen2-5-vl-a-hands-on-code-walkthrough-5fba8a34e7d7](https://pub.towardsai.net/qwen2-5-vl-a-hands-on-code-walkthrough-5fba8a34e7d7)  
7. Image zoom tool uses incorrect resize factor (32 instead of 28\) · Issue \#1831 · QwenLM/Qwen3-VL \- GitHub, 12월 19, 2025에 액세스, [https://github.com/QwenLM/Qwen3-VL/issues/1831](https://github.com/QwenLM/Qwen3-VL/issues/1831)  
8. QwenLM/Qwen3-VL: Qwen3-VL is the multimodal large ... \- GitHub, 12월 19, 2025에 액세스, [https://github.com/QwenLM/Qwen3-VL](https://github.com/QwenLM/Qwen3-VL)  
9. Ollama Installation for macOS, Linux, and Windows \- GitHub Pages, 12월 19, 2025에 액세스, [https://translucentcomputing.github.io/kubert-assistant-lite/ollama.html](https://translucentcomputing.github.io/kubert-assistant-lite/ollama.html)  
10. Set up Ollama on macOS | GPT for Work Documentation, 12월 19, 2025에 액세스, [https://gptforwork.com/help/ai-models/endpoints/set-up-ollama-on-macos](https://gptforwork.com/help/ai-models/endpoints/set-up-ollama-on-macos)  
11. docs/faq.md · 9164b0161bcb24e543cba835a8863b80af2c0c21 · Till-Ole Herbst / Ollama \- GitLab, 12월 19, 2025에 액세스, [https://gitlab.informatik.uni-halle.de/ambcj/ollama/-/blob/9164b0161bcb24e543cba835a8863b80af2c0c21/docs/faq.md](https://gitlab.informatik.uni-halle.de/ambcj/ollama/-/blob/9164b0161bcb24e543cba835a8863b80af2c0c21/docs/faq.md)  
12. Request: keepalive property \- Web APIs | MDN, 12월 19, 2025에 액세스, [https://developer.mozilla.org/en-US/docs/Web/API/Request/keepalive](https://developer.mozilla.org/en-US/docs/Web/API/Request/keepalive)  
13. Qwen3-VL Technical Report \- ResearchGate, 12월 19, 2025에 액세스, [https://www.researchgate.net/publication/398026379\_Qwen3-VL\_Technical\_Report](https://www.researchgate.net/publication/398026379_Qwen3-VL_Technical_Report)  
14. How We Built Lightning-Fast Image Compression with Web Workers (And Why Your Users Will Thank You) | by Hawk Engineering | Medium, 12월 19, 2025에 액세스, [https://medium.com/@hawk-engineering/how-we-built-lightning-fast-image-compression-with-web-workers-and-why-your-users-will-thank-you-9cced5d44b9e](https://medium.com/@hawk-engineering/how-we-built-lightning-fast-image-compression-with-web-workers-and-why-your-users-will-thank-you-9cced5d44b9e)  
15. OffscreenCanvas \- Web APIs | MDN, 12월 19, 2025에 액세스, [https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas)  
16. Enhancing Graphics Performance with OffscreenCanvas and D3.js \- DEV Community, 12월 19, 2025에 액세스, [https://dev.to/jeevankishore/enhancing-graphics-performance-with-offscreencanvas-and-d3js-19ka](https://dev.to/jeevankishore/enhancing-graphics-performance-with-offscreencanvas-and-d3js-19ka)  
17. Resize image with javascript canvas (smoothly) \- Stack Overflow, 12월 19, 2025에 액세스, [https://stackoverflow.com/questions/19262141/resize-image-with-javascript-canvas-smoothly](https://stackoverflow.com/questions/19262141/resize-image-with-javascript-canvas-smoothly)  
18. ollama/docs/api.md at main · ollama/ollama \- GitHub, 12월 19, 2025에 액세스, [https://github.com/ollama/ollama/blob/main/docs/api.md](https://github.com/ollama/ollama/blob/main/docs/api.md)  
19. Ollama.API \- Hexdocs, 12월 19, 2025에 액세스, [https://hexdocs.pm/ollama/0.2.0/Ollama.API.html](https://hexdocs.pm/ollama/0.2.0/Ollama.API.html)  
20. Ollama JavaScript library \- GitHub, 12월 19, 2025에 액세스, [https://github.com/ollama/ollama-js](https://github.com/ollama/ollama-js)  
21. EnvInjection: Environmental Prompt Injection Attack to Multi-modal Web Agents \- arXiv, 12월 19, 2025에 액세스, [https://arxiv.org/html/2505.11717v1](https://arxiv.org/html/2505.11717v1)