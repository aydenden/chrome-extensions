# **추론형 멀티모달 AI 모델(Qwen3-VL)의 브라우저 기반 상호작용 최적화 및 구조적 응답 안정성 확보를 위한 심층 기술 보고서**

## **1\. 서론: 생성형 AI의 추론 능력과 구조적 제약의 충돌**

현대 인공지능 기술의 발전은 단순한 패턴 매칭을 넘어 복잡한 논리적 추론을 수행하는 '추론 모델(Reasoning Models)'의 시대로 진입하고 있다. 특히 시각적 정보와 텍스트를 동시에 처리하는 멀티모달 모델(Vision-Language Models, VLMs)인 Qwen2.5-VL 및 Qwen3-VL 시리즈는 시각적 맥락을 분석하고 내부적인 사고 과정을 거쳐 결론을 도출하는 능력을 갖추고 있다.1 이러한 모델들은 복잡한 이미지 분석, 수학적 문제 해결, 그리고 문서 정보 추출(OCR)과 같은 작업에서 탁월한 성능을 발휘한다.

그러나 웹 애플리케이션 개발 환경, 특히 브라우저 기반의 클라이언트-서버 아키텍처에서 이러한 추론 모델을 통합할 때 심각한 기술적 마찰이 발생하고 있다. 개발자들은 애플리케이션의 신뢰성을 위해 JSON(JavaScript Object Notation)과 같은 결정론적이고 구조화된 데이터 형식을 요구하지만, 추론 모델은 본질적으로 비구조적인 자연어 형태의 '사고 과정(Chain of Thought, CoT)'을 우선적으로 생성하도록 훈련되어 있기 때문이다.

사용자가 Ollama와 같은 로컬 인퍼런스 프레임워크에서 format: "json" 옵션을 활성화하여 강제적인 구조화를 시도할 경우, 모델의 내부적인 추론 토큰 생성 확률 분포와 Ollama가 적용하는 문법 제약(Grammar Masking) 간의 충돌이 발생한다. 이로 인해 응답 본문(content)이 비어버리거나(empty response), 추론 과정이 생략되어 답변의 품질이 저하되거나, JSON 구문이 파괴되는 현상이 빈번하게 보고되고 있다.3

본 보고서는 이러한 문제의 근본 원인을 모델 아키텍처와 추론 엔진의 상호작용 관점에서 심층 분석하고, 브라우저 환경에서 Qwen3-VL과 같은 사고형 모델의 잠재력을 온전히 활용하면서도 안정적인 구조적 출력을 확보할 수 있는 HTTP 요청 전략, 프롬프트 엔지니어링 최적화, 그리고 클라이언트 사이드 처리 방안을 포괄적으로 제시한다.

## ---

**2\. 추론 모델의 작동 메커니즘과 구조적 출력의 딜레마**

Qwen3-VL과 같은 최신 모델이 겪는 '빈 응답' 또는 '불안정한 출력' 문제는 단순한 버그가 아니라, 거대 언어 모델(LLM)의 생성 방식과 제약 조건 간의 확률론적 불일치에서 기인하는 구조적 문제이다. 이를 해결하기 위해서는 모델이 토큰을 생성하는 메커니즘과 Ollama가 출력을 제어하는 방식을 이해해야 한다.

### **2.1 추론 토큰 생성과 문법 제약의 충돌**

추론 능력이 강화된 모델, 특히 DeepSeek-R1의 증류(distillation) 버전이나 Qwen의 Thinking 모델들은 사용자 입력에 대해 즉각적인 정답을 내놓기보다, 내부적인 사고 과정을 먼저 출력하도록 미세 조정(Fine-tuning)되어 있다. 이 과정은 통상적으로 \<think\>와 \</think\> 태그 사이의 비구조적 텍스트로 표현된다.6

문제는 Ollama의 format: "json" 기능이 작동하는 방식에 있다. Ollama는 백엔드인 llama.cpp를 통해 문맥 자유 문법(Context-Free Grammar, GBNF)을 적용하여, 모델이 생성할 수 있는 다음 토큰의 후보군을 JSON 문법에 부합하는 것들로만 제한한다.8

* **확률 분포의 모순:** 추론 모델은 프롬프트를 받으면 가장 먼저 \<think\>(또는 \<) 토큰을 생성할 확률이 압도적으로 높게 설정되어 있다. 그러나 format: "json"이 적용되면 유효한 시작 토큰은 오직 { (객체 시작) 또는 \`

### **2.2 사고 과정의 생략과 성능 저하**

설령 문법 제약이 성공적으로 작동하여 모델이 \<think\> 블록을 건너뛰고 바로 JSON을 생성하기 시작하더라도 문제는 남는다. 추론 모델의 높은 성능은 중간 단계의 사고 과정에서 도출되는 논리적 연결 고리에 의존한다. 이 과정이 강제로 생략(suppression)될 경우, 모델은 복잡한 시각적 추론(예: "이미지의 왼쪽 상단에 있는 텍스트를 읽고 합계를 계산하라")을 수행할 "메모장"을 잃게 되는 것과 같다. 이는 환각(Hallucination) 빈도를 높이고 결과의 정확도를 치명적으로 떨어뜨린다.5

### **2.3 Qwen-VL 아키텍처의 특수성: 동적 해상도와 토큰 경제**

Qwen3-VL 및 Qwen2.5-VL은 기존의 고정 해상도 모델과 달리 'Naive Dynamic Resolution' 기술을 채택하고 있다.1 이는 이미지를 고정된 크기(예: 336x336)로 리사이징하지 않고, 원본 해상도와 비율을 유지하면서 가변적인 수의 시각 토큰으로 변환하는 방식이다.

* **패치 정렬(Patch Alignment):** Qwen2.5-VL은 이미지를 14x14 크기의 패치로 나누며, 입력 해상도를 **28**의 배수로 맞춘다.9 반면 Qwen3-VL은 **32**의 배수로 정렬된다.11  
* **컨텍스트 윈도우의 압박:** 고해상도 이미지가 입력될 경우 시각 토큰만으로 수천 개를 차지할 수 있다. 여기에 사고 과정(Thinking process)이 생성하는 긴 텍스트까지 더해지면, Ollama의 기본 컨텍스트 설정(통상 2048 또는 4096 토큰)을 초과하기 쉽다. 컨텍스트가 꽉 차면 모델은 이전 지시사항(예: "JSON으로 출력하라")을 잊어버리거나(truncation), 생성을 멈추게 되어 불안정한 응답의 원인이 된다.12

## ---

**3\. 안정적인 응답을 위한 HTTP 요청 최적화 전략**

브라우저 환경에서 Qwen3-VL과 같은 사고형 모델로부터 일관된 응답을 받기 위해서는 API 요청 파라미터를 정교하게 조정해야 한다. 단순한 format: "json" 설정은 지양해야 하며, 모델의 특성을 고려한 파라미터 조합이 필수적이다.

### **3.1 think 파라미터와 format 옵션의 분리 운용**

Ollama는 최근 think 파라미터를 도입하여 사고 과정과 최종 답변을 분리하여 처리할 수 있는 기능을 제공한다.6 이를 활용하는 것이 문제 해결의 핵심이다.

**권장 전략:** 강력한 추론 모델을 사용할 때는 요청 본문에 format: "json"을 직접 사용하여 전체 출력을 강제하지 않는 것이 좋다. 대신, think: true를 사용하여 사고 과정을 허용하고, 시스템 프롬프트를 통해 최종 답변만을 JSON으로 유도하는 방식을 사용해야 한다.

* **think: true 설정:** 이 옵션은 Ollama에게 모델의 사고 과정(\<think\>... \</think\>)을 별도의 필드(thinking)로 파싱하도록 지시한다. 스트리밍 응답 시, 사고 과정은 thinking 필드로, 최종 답변은 content 필드로 분리되어 전송된다.6  
* **format 옵션의 위험성:** format: "json"을 think: true와 함께 사용할 때, 일부 모델 버전이나 양자화된 버전에서는 문법 제약이 \<think\> 태그의 시작조차 막아버리는 현상이 여전히 관찰된다. 따라서 JSON 구조화는 프롬프트 레벨의 지시(Instruction)로 처리하는 것이 훨씬 안정적이다.14

### **3.2 컨텍스트 윈도우(num\_ctx)의 명시적 확장**

Qwen-VL 모델의 시각 처리 능력과 사고 과정의 길이를 고려할 때, 기본 컨텍스트 크기는 절대적으로 부족하다. 브라우저에서 고해상도 이미지를 전송할 경우, num\_ctx를 명시적으로 확장해야 한다.

| 모델 유형 | 권장 num\_ctx | 이유 |
| :---- | :---- | :---- |
| 일반 텍스트 모델 | 4,096 \~ 8,192 | 텍스트 대화 및 간단한 요약 |
| **Qwen-VL (Thinking)** | **16,384 \~ 32,768** | 고해상도 이미지 토큰 \+ 긴 사고 과정 \+ JSON 출력 |

API 요청 시 options 객체 내에 이를 반드시 포함해야 한다.13

JSON

"options": {  
  "num\_ctx": 32768,  
  "temperature": 0.1  // JSON 구조의 일관성을 위해 낮은 온도 권장  
}

### **3.3 keep\_alive를 통한 지연 시간(Latency) 최적화**

브라우저 상호작용에서 모델 로딩 시간은 사용자 경험(UX)을 저해하는 주된 요인이다. Ollama는 기본적으로 5분 후 모델을 메모리에서 해제(unload)한다. Qwen3-VL과 같은 대형 모델은 재로딩에 수 초에서 수십 초가 소요될 수 있다.

* **해결책:** keep\_alive 파라미터를 사용하여 모델의 메모리 상주 시간을 제어한다. 연속적인 작업이 예상되는 경우 \-1(무한대) 또는 30m(30분)과 같이 충분한 시간을 설정하여 첫 번째 요청 이후의 대기 시간을 제거해야 한다.16

### **3.4 이미지 전송 방식: Base64 인코딩의 효율성 문제**

Ollama API는 이미지 전송을 위해 Base64 인코딩된 문자열을 요구한다.18 그러나 브라우저에서 고해상도 이미지를 Base64로 변환하면 원본 바이너리 대비 약 33%의 데이터 크기 증가가 발생하며, 이는 네트워크 대역폭과 파싱 비용을 증가시킨다.20

* **최적화 방안:** 클라이언트 사이드에서 이미지를 전송하기 전, HTML5 Canvas를 사용하여 Qwen 모델의 패치 크기에 맞게 리사이징한 후 인코딩하는 것이 중요하다(5장 참조). 이는 불필요한 데이터 전송을 줄이고 모델의 연산 부담을 경감시킨다.

## ---

**4\. 구조적 응답 확보를 위한 프롬프트 엔지니어링 최적화**

API 파라미터만으로는 모델의 확률적 행동을 완전히 제어하기 어렵다. 따라서 프롬프트 엔지니어링을 통해 모델이 사고 과정과 JSON 출력 간의 충돌을 일으키지 않도록 유도해야 한다.

### **4.1 사고와 출력의 단계적 분리 (Chain of Thought Separation)**

모델에게 "생각하지 말고 JSON만 내놓으라"고 지시하는 것은 추론 모델의 장점을 버리는 것이다. 대신 "먼저 충분히 생각하고, 그 결과를 바탕으로 JSON을 작성하라"고 지시해야 한다. 이를 위한 시스템 프롬프트 패턴은 다음과 같다.

**최적화된 시스템 프롬프트 예시:**

"당신은 시각적 정보를 정밀하게 분석하는 AI 에이전트입니다.

1. 먼저 사용자의 요청을 분석하고 이미지의 세부 사항을 파악하는 과정을 \<think\> 태그 안에 자유롭게 기술하십시오.  
2. 추론이 끝나면, 최종 답변을 반드시 유효한 JSON 형식으로만 출력하십시오.  
3. JSON 외의 어떤 설명이나 마크다운(\`\`\`json 등)도 포함하지 마십시오.  
4. 목표 JSON 스키마: {\\"summary\\": string, \\"details\\": array}"

이 방식은 모델이 \<think\> 태그를 통해 내부의 혼란을 해소하고(entropy reduction), 명확해진 상태에서 JSON을 생성하도록 유도하여 문법 충돌 확률을 낮춘다.5

### **4.2 스키마 내재화 전략 (Integrated Reasoning Field)**

만약 format: "json" (JSON Schema 모드)을 반드시 사용해야 한다면, 스키마 자체에 사고 과정을 담을 수 있는 필드를 포함시키는 것이 강력한 해결책이 된다. 이는 모델이 JSON 문법을 위반하지 않으면서도 추론 텍스트를 생성할 수 있는 합법적인 공간을 제공한다.22

**권장 JSON 스키마 구조:**

JSON

{  
  "type": "object",  
  "properties": {  
    "reasoning\_trace": {  
      "type": "string",  
      "description": "이미지 분석 과정과 논리적 근거를 단계별로 서술"  
    },  
    "final\_result": {  
      "type": "object",  
      "properties": {... } // 실제 필요한 데이터 구조  
    }  
  },  
  "required": \["reasoning\_trace", "final\_result"\]  
}

이 방식을 사용하면 Ollama의 문법 제약 하에서도 모델이 자연스럽게 사고 과정을 출력할 수 있어, 빈 응답 문제를 효과적으로 방지할 수 있다.

### **4.3 공간적 추론을 위한 좌표계 명시**

Qwen-VL 모델은 이미지 내 객체의 위치(Grounding)를 파악할 때 특정 좌표계(주로 1000x1000 정규화 좌표)를 사용한다. 프롬프트에서 이를 명시하지 않으면 모델이 좌표를 환각(hallucination)하거나 잘못된 형식으로 출력할 수 있다.2

* **최적화된 지시:** "객체의 위치를 \[x1, y1, x2, y2\] 형식의 바운딩 박스로 추출하되, 좌표는 1000x1000 스케일로 정규화하여 JSON 배열에 담으십시오."

## ---

**5\. 클라이언트 사이드(브라우저) 구현 및 스트림 처리**

서버 측 설정이 완벽하더라도 브라우저에서 대용량의 스트리밍 데이터를 적절히 처리하지 못하면 사용자 경험은 불안정해진다. 특히 JSON과 XML(Thinking tag)이 혼재된 스트림을 파싱하는 것은 JSON.parse()만으로는 불가능하다.

### **5.1 하이브리드 스트림 파서 아키텍처**

stream: true로 요청을 보낼 경우, Ollama는 NDJSON(Newline Delimited JSON) 형식으로 데이터를 전송한다. 각 청크(chunk)는 thinking 필드와 content 필드를 포함할 수 있다.

**JavaScript 처리 로직:**

1. **Fetch API 및 ReadableStream:** 응답을 스트림으로 읽어들인다.  
2. **TextDecoder:** 바이너리 청크를 UTF-8 문자열로 디코딩한다. 주의할 점은 멀티바이트 문자(한글, 이모지 등)가 청크 경계에서 잘릴 수 있다는 점이다. 이를 방지하기 위해 stream: true 옵션을 가진 디코더를 사용해야 한다.23  
3. **이중 버퍼링(Dual Buffering):**  
   * thinkingBuffer: chunk.message.thinking 데이터를 누적하여 UI의 '생각 중...' 영역에 실시간으로 업데이트한다.  
   * contentBuffer: chunk.message.content 데이터를 누적한다.  
4. **최종 파싱:** 스트림이 종료(done: true)되면 contentBuffer에 쌓인 문자열을 JSON.parse()하여 최종 데이터 객체로 변환한다.

### **5.2 클라이언트 사이드 이미지 최적화 (Canvas API 활용)**

Qwen3-VL의 성능을 극대화하고 전송 지연을 줄이기 위해 브라우저에서 이미지를 전처리해야 한다. 앞서 언급한 모델의 패치 정렬(32px)에 맞추어 이미지를 리사이징하면, 모델 내부의 불필요한 보간 연산을 줄이고 인식률을 높일 수 있다.24

이미지 처리 공식:

$$TargetDimension \= \\text{Math.round}\\left(\\frac{OriginalDimension}{32}\\right) \\times 32$$  
이 공식을 적용하여 HTML Canvas에 이미지를 그린 후, canvas.toBlob() 또는 toDataURL()을 사용하여 Base64 문자열을 생성한다. 이는 네트워크 페이로드를 최적화할 뿐만 아니라, 모델의 입력 규격에 정확히 부합하는 데이터를 제공함으로써 추론 안정성을 향상시킨다.

### **5.3 AbortController를 이용한 요청 제어**

생성형 AI의 응답은 시간이 오래 걸릴 수 있다. 사용자가 페이지를 이탈하거나 새로운 요청을 보낼 때 기존의 불필요한 연산을 중단시키기 위해 AbortController를 필수적으로 구현해야 한다.

JavaScript

const controller \= new AbortController();  
const signal \= controller.signal;

fetch(url, { signal,... })  
 .catch(err \=\> {  
    if (err.name \=== 'AbortError') {  
      console.log('요청이 취소되었습니다.');  
    }  
  });

// 취소 필요 시  
controller.abort();

이는 불필요한 GPU 자원 점유를 방지하고, Ollama 서버의 대기열(Queue)이 막히는 것을 예방한다.26

## ---

**6\. 고급 문제 해결 및 설정**

### **6.1 반복 루프 및 토큰 반복 현상 해결**

Qwen2.5-VL 모델 사용 시 특정 단어나 구절이 무한히 반복되는 현상(repetition loop)이 보고되었다.3 이는 특히 OCR 작업과 같이 텍스트 밀도가 높은 이미지에서 자주 발생한다.

* **해결:** options 파라미터에서 repeat\_penalty를 1.1 이상(기본값은 보통 1.0)으로 설정하여 모델이 동일한 토큰을 연속해서 생성하는 것을 억제해야 한다. 또한 temperature를 0이 아닌 0.1\~0.2 정도로 미세하게 높여 결정론적 루프에서 빠져나올 수 있는 여지를 주는 것이 좋다.

### **6.2 하드웨어 병렬 처리 (OLLAMA\_NUM\_PARALLEL)**

여러 사용자가 동시에 브라우저를 통해 요청을 보낼 경우, Ollama의 OLLAMA\_NUM\_PARALLEL 환경 변수가 중요하다.

* **주의사항:** 이 값을 높이면 여러 요청을 동시에 처리할 수 있지만, 각 요청마다 컨텍스트 윈도우(num\_ctx)만큼의 VRAM을 추가로 할당한다.28  
* **권장:** Qwen3-VL과 같이 VRAM 소모가 큰 모델을 사용할 때는 이 값을 보수적으로 설정(예: 1 또는 2)하고, 대신 OLLAMA\_MAX\_QUEUE를 통해 대기열을 관리하는 것이 시스템 안정성(OOM 방지) 측면에서 유리하다.

## ---

**7\. 결론 및 요약**

브라우저 환경에서 Ollama의 Qwen3-VL 모델을 활용하여 일관된 구조적 응답을 얻기 위해서는 모델의 '사고 본능'과 애플리케이션의 '구조적 요구' 사이의 균형을 맞추는 엔지니어링이 필수적이다.

핵심적인 해결책은 다음과 같이 요약된다:

1. **사고의 수용:** format: "json"으로 사고를 억제하지 말고, think: true 파라미터나 스키마 내 reasoning 필드를 통해 사고 과정을 수용해야 한다.  
2. **컨텍스트 확보:** 시각 정보와 사고 과정을 모두 담을 수 있도록 num\_ctx를 최소 16k 이상으로 충분히 확보해야 한다.  
3. **정교한 스트리밍:** 클라이언트 측에서 사고 필드와 콘텐츠 필드를 분리하여 파싱하는 하이브리드 스트림 처리를 구현해야 한다.  
4. **이미지 최적화:** 모델 아키텍처(32px 그리드)에 맞춘 클라이언트 사이드 리사이징을 통해 효율성과 정확도를 동시에 높여야 한다.

이러한 전략을 종합적으로 적용함으로써, 개발자는 추론 모델의 강력한 인지 능력을 훼손하지 않으면서도 웹 애플리케이션이 요구하는 정형화된 데이터를 안정적으로 확보할 수 있다. 이는 단순한 챗봇을 넘어, 복잡한 시각적 데이터를 분석하고 판단하는 에이전트형 애플리케이션을 구축하는 데 있어 필수적인 기술적 토대이다.

#### **참고 자료**

1. Qwen2.5-VL 7B Instruct Free Chat Online \- Skywork.ai, 12월 19, 2025에 액세스, [https://skywork.ai/blog/models/qwen2-5-vl-7b-instruct-free-chat-online/](https://skywork.ai/blog/models/qwen2-5-vl-7b-instruct-free-chat-online/)  
2. Qwen2.5 VL\! Qwen2.5 VL\! Qwen2.5 VL\! | Qwen, 12월 19, 2025에 액세스, [https://qwenlm.github.io/blog/qwen2.5-vl/](https://qwenlm.github.io/blog/qwen2.5-vl/)  
3. Token repetition issue with Qwen2.5-VL \#10767 \- GitHub, 12월 19, 2025에 액세스, [https://github.com/ollama/ollama/issues/10767](https://github.com/ollama/ollama/issues/10767)  
4. Deepseek R1 with JSON returns partial message text (a bunch of new lines) \#5816 \- GitHub, 12월 19, 2025에 액세스, [https://github.com/dotnet/extensions/issues/5816](https://github.com/dotnet/extensions/issues/5816)  
5. How does Ollama structured output effect reasoning models? : r/LocalLLaMA \- Reddit, 12월 19, 2025에 액세스, [https://www.reddit.com/r/LocalLLaMA/comments/1ixs8yo/how\_does\_ollama\_structured\_output\_effect/](https://www.reddit.com/r/LocalLLaMA/comments/1ixs8yo/how_does_ollama_structured_output_effect/)  
6. Thinking \- Ollama's documentation, 12월 19, 2025에 액세스, [https://docs.ollama.com/capabilities/thinking](https://docs.ollama.com/capabilities/thinking)  
7. Thinking · Ollama Blog, 12월 19, 2025에 액세스, [https://ollama.com/blog/thinking](https://ollama.com/blog/thinking)  
8. How Does Ollama's Structured Outputs Work?, 12월 19, 2025에 액세스, [https://blog.danielclayton.co.uk/posts/ollama-structured-outputs/](https://blog.danielclayton.co.uk/posts/ollama-structured-outputs/)  
9. Qwen/Qwen2.5-VL-7B-Instruct \- Hugging Face, 12월 19, 2025에 액세스, [https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct](https://huggingface.co/Qwen/Qwen2.5-VL-7B-Instruct)  
10. Qwen/Qwen2-VL-7B-Instruct · Hugging Face, 12월 19, 2025에 액세스, [https://huggingface.co/Qwen/Qwen2-VL-7B-Instruct](https://huggingface.co/Qwen/Qwen2-VL-7B-Instruct)  
11. Qwen3-VL is the multimodal large language model series developed by Qwen team, Alibaba Cloud. \- GitHub, 12월 19, 2025에 액세스, [https://github.com/QwenLM/Qwen3-VL](https://github.com/QwenLM/Qwen3-VL)  
12. Ollama | aider, 12월 19, 2025에 액세스, [https://aider.chat/docs/llms/ollama.html](https://aider.chat/docs/llms/ollama.html)  
13. PSA for Ollama Users: Your Context Length Might Be Lower Than You Think \- Reddit, 12월 19, 2025에 액세스, [https://www.reddit.com/r/LocalLLaMA/comments/1nffm7r/psa\_for\_ollama\_users\_your\_context\_length\_might\_be/](https://www.reddit.com/r/LocalLLaMA/comments/1nffm7r/psa_for_ollama_users_your_context_length_might_be/)  
14. How to Turn off Thinking on ollama for DS-R1? \- Reddit, 12월 19, 2025에 액세스, [https://www.reddit.com/r/ollama/comments/1i7r6hf/how\_to\_turn\_off\_thinking\_on\_ollama\_for\_dsr1/](https://www.reddit.com/r/ollama/comments/1i7r6hf/how_to_turn_off_thinking_on_ollama_for_dsr1/)  
15. While Qwen3-vl has very good OCR/image caption abilities, it still doesn't seem to generate accurate coordinates nor bounding boxes of objects in the screen. I just take a screenshot and send as-is and its accuracy is off. Tried resizing, no dice neither. Anyone else have this problem? : r \- Reddit, 12월 19, 2025에 액세스, [https://www.reddit.com/r/LocalLLaMA/comments/1okg0gm/while\_qwen3vl\_has\_very\_good\_ocrimage\_caption/](https://www.reddit.com/r/LocalLLaMA/comments/1okg0gm/while_qwen3vl_has_very_good_ocrimage_caption/)  
16. How to Speed Up Ollama Performance \- Database Mart, 12월 19, 2025에 액세스, [https://www.databasemart.com/kb/how-to-speed-up-ollama-performance](https://www.databasemart.com/kb/how-to-speed-up-ollama-performance)  
17. FAQ \- Ollama English Documentation, 12월 19, 2025에 액세스, [https://ollama.readthedocs.io/en/faq/](https://ollama.readthedocs.io/en/faq/)  
18. ollama/docs/api.md at main · ollama/ollama · GitHub, 12월 19, 2025에 액세스, [https://github.com/ollama/ollama/blob/main/docs/api.md](https://github.com/ollama/ollama/blob/main/docs/api.md)  
19. Vision \- Ollama's documentation, 12월 19, 2025에 액세스, [https://docs.ollama.com/capabilities/vision](https://docs.ollama.com/capabilities/vision)  
20. Why You Should Avoid Base64 for Image Conversion in APIs | by Sandeep Kella \- Medium, 12월 19, 2025에 액세스, [https://medium.com/@sandeepkella23/why-you-should-avoid-base64-for-image-conversion-in-apis-c8d77830bfd8](https://medium.com/@sandeepkella23/why-you-should-avoid-base64-for-image-conversion-in-apis-c8d77830bfd8)  
21. To upload a file what are the pros and cons of sending base64 in post body vs multipart/form-data \- Stack Overflow, 12월 19, 2025에 액세스, [https://stackoverflow.com/questions/65350640/to-upload-a-file-what-are-the-pros-and-cons-of-sending-base64-in-post-body-vs-mu](https://stackoverflow.com/questions/65350640/to-upload-a-file-what-are-the-pros-and-cons-of-sending-base64-in-post-body-vs-mu)  
22. Structured Outputs in Ollama \- What's Your Recipe for Success? \- Reddit, 12월 19, 2025에 액세스, [https://www.reddit.com/r/ollama/comments/1jflnxl/structured\_outputs\_in\_ollama\_whats\_your\_recipe/](https://www.reddit.com/r/ollama/comments/1jflnxl/structured_outputs_in_ollama_whats_your_recipe/)  
23. How to Stop Ollama Model Streaming | by Revlae Sky \- Medium, 12월 19, 2025에 액세스, [https://medium.com/@revlae/how-to-stop-ollama-model-streaming-600a222b4797](https://medium.com/@revlae/how-to-stop-ollama-model-streaming-600a222b4797)  
24. Transform Your Visuals: How To Resize An Image in JavaScript \- Cloudinary, 12월 19, 2025에 액세스, [https://cloudinary.com/guides/bulk-image-resize/transform-your-visuals-how-to-resize-an-image-in-javascript](https://cloudinary.com/guides/bulk-image-resize/transform-your-visuals-how-to-resize-an-image-in-javascript)  
25. Convert Blob to Base64 and Vice Versa in JavaScript \- Haikel Fazzani, 12월 19, 2025에 액세스, [https://www.haikel-fazzani.eu.org/javascript/convert-blob-to-base64](https://www.haikel-fazzani.eu.org/javascript/convert-blob-to-base64)  
26. AbortController: abort() method \- Web APIs \- MDN Web Docs, 12월 19, 2025에 액세스, [https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort](https://developer.mozilla.org/en-US/docs/Web/API/AbortController/abort)  
27. Fetch: Abort \- The Modern JavaScript Tutorial, 12월 19, 2025에 액세스, [https://javascript.info/fetch-abort](https://javascript.info/fetch-abort)  
28. What is the maximum value for OLLAMA\_NUM\_PARALLEL in Ollama? \- Reddit, 12월 19, 2025에 액세스, [https://www.reddit.com/r/ollama/comments/1ipm76f/what\_is\_the\_maximum\_value\_for\_ollama\_num\_parallel/](https://www.reddit.com/r/ollama/comments/1ipm76f/what_is_the_maximum_value_for_ollama_num_parallel/)  
29. OLLAMA\_MAX\_QUEUE and OLLAMA\_NUM\_PARALLEL : r/ollama \- Reddit, 12월 19, 2025에 액세스, [https://www.reddit.com/r/ollama/comments/1i48lo8/ollama\_max\_queue\_and\_ollama\_num\_parallel/](https://www.reddit.com/r/ollama/comments/1i48lo8/ollama_max_queue_and_ollama_num_parallel/)