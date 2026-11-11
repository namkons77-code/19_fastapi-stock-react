import { useState, useEffect, useMemo } from "react";
import "./App.css";

function App() {
  const [apiUrl, setApiUrl] = useState("/api/samsung");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortAsc, setSortAsc] = useState(false); // false: 최신순, true: 과거순
  const [hoveredIndex, setHoveredIndex] = useState(null);

  // 데이터 가져오기 함수
  const fetchStockData = async (targetUrl = apiUrl) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`서버 응답 오류 (HTTP ${response.status})`);
      }
      const json = await response.json();
      if (!json || !Array.isArray(json.data)) {
        throw new Error("올바르지 않은 데이터 형식입니다.");
      }
      setData(json);
    } catch (err) {
      console.error("Fetch error:", err);
      setError(err.message || "데이터를 가져오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStockData();
  }, []);

  // 통계 계산
  const stats = useMemo(() => {
    if (!data || !data.data || data.data.length === 0) return null;
    const records = data.data;
    const latest = records[records.length - 1]; // 원본의 마지막이 최신 데이터
    const prev = records.length > 1 ? records[records.length - 2] : null;

    let maxPrice = -Infinity;
    let minPrice = Infinity;
    let totalVolume = 0;
    let maxDate = "";
    let minDate = "";

    records.forEach((row) => {
      const close = Number(row.Close) || 0;
      const vol = Number(row.Volume) || 0;
      totalVolume += vol;

      if (close > maxPrice) {
        maxPrice = close;
        maxDate = row.Date;
      }
      if (close < minPrice && close > 0) {
        minPrice = close;
        minDate = row.Date;
      }
    });

    const avgVolume = Math.round(totalVolume / records.length);
    const diff = prev ? latest.Close - prev.Close : 0;
    const diffRate =
      latest.Change != null
        ? latest.Change * 100
        : prev
          ? ((latest.Close - prev.Close) / prev.Close) * 100
          : 0;

    return {
      latest,
      diff,
      diffRate,
      maxPrice,
      maxDate,
      minPrice,
      minDate,
      avgVolume,
      count: records.length,
    };
  }, [data]);

  // 테이블 표시용 정렬된 데이터
  const displayList = useMemo(() => {
    if (!data?.data) return [];
    const list = [...data.data];
    return sortAsc ? list : list.reverse();
  }, [data, sortAsc]);

  // 차트 계산 (SVG)
  const chartData = useMemo(() => {
    if (!data?.data || data.data.length < 2) return null;
    const records = data.data; // 시간순 정렬된 원본
    const closes = records.map((r) => Number(r.Close) || 0);
    const minVal = Math.min(...closes);
    const maxVal = Math.max(...closes);
    const padding = (maxVal - minVal) * 0.1 || 100;
    const yMin = Math.max(0, minVal - padding);
    const yMax = maxVal + padding;

    const width = 800;
    const height = 260;
    const padX = 20;
    const padY = 20;

    const points = records.map((r, i) => {
      const x = padX + (i / (records.length - 1)) * (width - padX * 2);
      const close = Number(r.Close) || 0;
      const y =
        height - padY - ((close - yMin) / (yMax - yMin)) * (height - padY * 2);
      return { x, y, date: r.Date, close, change: r.Change, volume: r.Volume };
    });

    // SVG path string
    const pathD = points.reduce(
      (acc, pt, idx) =>
        idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`,
      "",
    );

    // 영역 채우기용 closed path
    const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padY} L ${points[0].x} ${height - padY} Z`;

    return { points, pathD, areaD, width, height, yMin, yMax };
  }, [data]);

  const formatNumber = (num) => {
    if (num == null || isNaN(num)) return "-";
    return Number(num).toLocaleString("ko-KR");
  };

  const formatPercent = (rate) => {
    if (rate == null || isNaN(rate)) return "-";
    const sign = rate > 0 ? "+" : "";
    return `${sign}${rate.toFixed(2)}%`;
  };

  return (
    <div className="stock-app">
      {/* 상단 헤더 */}
      <header className="app-header">
        <div className="header-left">
          <div className="badge">KOSPI 005930</div>
          <h1>
            {data?.name || "삼성전자"} <span>최근 30일 시세</span>
          </h1>
        </div>

        {/* 연결 주소 설정 및 새로고침 */}
        <div className="server-control">
          <div className="url-input-wrap">
            <span className="dot online"></span>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="/api/samsung"
            />
          </div>
          <button
            className="btn-primary"
            onClick={() => fetchStockData(apiUrl)}
            disabled={loading}
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        </div>
      </header>

      {/* 서버 및 포트 바로가기 퀵 바 */}
      <div className="quick-port-bar">
        <span>빠른 서버 선택:</span>
        <button
          type="button"
          className={apiUrl === "/api/samsung" ? "active" : ""}
          onClick={() => {
            const url = "/api/samsung";
            setApiUrl(url);
            fetchStockData(url);
          }}
        >
          ✨ 프록시 권장 (/api/samsung)
        </button>
        <button
          type="button"
          className={apiUrl === "http://15.134.98.179/samsung" ? "active" : ""}
          onClick={() => {
            const url = "http://15.134.98.179/samsung";
            setApiUrl(url);
            fetchStockData(url);
          }}
        >
          원격 직접 (15.134.98.179)
        </button>
        <button
          type="button"
          className={apiUrl.includes(":8000") ? "active" : ""}
          onClick={() => {
            const url = "http://localhost:8000/samsung";
            setApiUrl(url);
            fetchStockData(url);
          }}
        >
          로컬 8000
        </button>
      </div>

      {/* 에러 상태 카드 */}
      {error && (
        <div className="error-card">
          <div className="error-icon">⚠️</div>
          <div className="error-body">
            <h3>FastAPI 서버에 연결할 수 없습니다</h3>
            <p>
              <strong>오류 내용:</strong> {error}
            </p>
            <div className="error-tips">
              <p>
                💡 <strong>확인해보세요:</strong>
              </p>
              <ol>
                <li>
                  <strong>배포 환경(Vercel HTTPS):</strong> 브라우저는 보안상 HTTPS 페이지에서 일반 HTTP 주소로의 직접 요청(Mixed Content)을 자동 차단합니다. 상단의 <strong>[✨ 프록시 권장 (/api/samsung)]</strong>을 클릭해주세요.
                </li>
                <li>
                  요청 주소가 올바른지 확인해주세요 (현재: <code>{apiUrl}</code>).
                </li>
                <li>
                  원격 서버(<code>http://15.134.98.179/samsung</code>) 또는 로컬 서버 실행 상태를 확인해주세요.
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* 로딩 인디케이터 */}
      {loading && !data && (
        <div className="loading-card">
          <div className="spinner"></div>
          <p>삼성전자 주가 데이터를 불러오는 중입니다...</p>
        </div>
      )}

      {/* 데이터 표시 영역 */}
      {data && stats && (
        <div className="content-grid">
          {/* 주요 통계 카드 4종 */}
          <div className="stats-row">
            <div className="stat-card main-price">
              <div className="card-label">최신 종가 (현재가)</div>
              <div className="card-value-lg">
                {formatNumber(stats.latest.Close)}
                <span className="unit">원</span>
              </div>
              <div className={`card-change ${stats.diff >= 0 ? "up" : "down"}`}>
                <span className="change-arrow">
                  {stats.diff >= 0 ? "▲" : "▼"}
                </span>
                <span>{formatNumber(Math.abs(stats.diff))}원</span>
                <span className="change-rate">
                  ({formatPercent(stats.diffRate)})
                </span>
              </div>
              <div className="card-sub">{stats.latest.Date} 기준</div>
            </div>

            <div className="stat-card">
              <div className="card-label">30일 최고가</div>
              <div className="card-value text-red">
                {formatNumber(stats.maxPrice)} <span className="unit">원</span>
              </div>
              <div className="card-sub">기록일: {stats.maxDate}</div>
            </div>

            <div className="stat-card">
              <div className="card-label">30일 최저가</div>
              <div className="card-value text-blue">
                {formatNumber(stats.minPrice)} <span className="unit">원</span>
              </div>
              <div className="card-sub">기록일: {stats.minDate}</div>
            </div>

            <div className="stat-card">
              <div className="card-label">30일 일평균 거래량</div>
              <div className="card-value">
                {formatNumber(stats.avgVolume)} <span className="unit">주</span>
              </div>
              <div className="card-sub">조회된 영업일: {stats.count}일</div>
            </div>
          </div>

          {/* 차트 영역 */}
          {chartData && (
            <div className="chart-card">
              <div className="card-header">
                <h3>최근 30일 종가 추이</h3>
                <span className="chart-hint">
                  마우스를 올리면 날짜와 가격을 확인할 수 있습니다.
                </span>
              </div>

              <div className="svg-container">
                <svg
                  viewBox={`0 0 ${chartData.width} ${chartData.height}`}
                  className="stock-svg-chart"
                >
                  <defs>
                    <linearGradient
                      id="chartGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#ef4444"
                        stopOpacity="0.35"
                      />
                      <stop
                        offset="100%"
                        stopColor="#ef4444"
                        stopOpacity="0.0"
                      />
                    </linearGradient>
                  </defs>

                  {/* 배경 가이드라인 */}
                  <line
                    x1="20"
                    y1={chartData.height - 20}
                    x2={chartData.width - 20}
                    y2={chartData.height - 20}
                    className="grid-line"
                  />
                  <line
                    x1="20"
                    y1={chartData.height / 2}
                    x2={chartData.width - 20}
                    y2={chartData.height / 2}
                    className="grid-line dashed"
                  />
                  <line
                    x1="20"
                    y1="20"
                    x2={chartData.width - 20}
                    y2="20"
                    className="grid-line dashed"
                  />

                  {/* 영역 채우기 */}
                  <path d={chartData.areaD} fill="url(#chartGradient)" />

                  {/* 라인 */}
                  <path d={chartData.pathD} className="chart-path" />

                  {/* 마우스 호버 표시선 및 포인트 */}
                  {hoveredIndex !== null && chartData.points[hoveredIndex] && (
                    <g>
                      <line
                        x1={chartData.points[hoveredIndex].x}
                        y1="20"
                        x2={chartData.points[hoveredIndex].x}
                        y2={chartData.height - 20}
                        className="hover-line"
                      />
                      <circle
                        cx={chartData.points[hoveredIndex].x}
                        cy={chartData.points[hoveredIndex].y}
                        r="6"
                        className="hover-point"
                      />
                    </g>
                  )}

                  {/* 각 데이터 포인트 호버 감지 영역 */}
                  {chartData.points.map((pt, i) => (
                    <circle
                      key={i}
                      cx={pt.x}
                      cy={pt.y}
                      r="12"
                      className="hit-target"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                  ))}
                </svg>

                {/* 차트 툴팁 */}
                {hoveredIndex !== null && chartData.points[hoveredIndex] && (
                  <div
                    className="chart-tooltip"
                    style={{
                      left: `${(chartData.points[hoveredIndex].x / chartData.width) * 100}%`,
                    }}
                  >
                    <div className="tooltip-date">
                      {chartData.points[hoveredIndex].date}
                    </div>
                    <div className="tooltip-price">
                      {formatNumber(chartData.points[hoveredIndex].close)}원
                    </div>
                    {chartData.points[hoveredIndex].change != null && (
                      <div
                        className={`tooltip-rate ${
                          chartData.points[hoveredIndex].change >= 0
                            ? "up"
                            : "down"
                        }`}
                      >
                        {formatPercent(
                          chartData.points[hoveredIndex].change * 100,
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="chart-footer-dates">
                <span>{chartData.points[0]?.date}</span>
                <span>
                  {
                    chartData.points[Math.floor(chartData.points.length / 2)]
                      ?.date
                  }
                </span>
                <span>
                  {chartData.points[chartData.points.length - 1]?.date}
                </span>
              </div>
            </div>
          )}

          {/* 일별 상세 테이블 */}
          <div className="table-card">
            <div className="card-header">
              <h3>일별 상세 시세 ({data.data.length}영업일)</h3>
              <button
                type="button"
                className="btn-sort"
                onClick={() => setSortAsc(!sortAsc)}
              >
                정렬: {sortAsc ? "과거순 ▲" : "최신순 ▼"}
              </button>
            </div>

            <div className="table-wrap">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th className="align-right">종가</th>
                    <th className="align-right">등락률</th>
                    <th className="align-right">시가</th>
                    <th className="align-right">고가</th>
                    <th className="align-right">저가</th>
                    <th className="align-right">거래량</th>
                  </tr>
                </thead>
                <tbody>
                  {displayList.map((row) => {
                    const isPositive = row.Change > 0;
                    const isNegative = row.Change < 0;
                    return (
                      <tr key={row.Date}>
                        <td className="font-mono">{row.Date}</td>
                        <td className="align-right font-bold">
                          {formatNumber(row.Close)}원
                        </td>
                        <td
                          className={`align-right font-bold ${
                            isPositive
                              ? "text-red"
                              : isNegative
                                ? "text-blue"
                                : ""
                          }`}
                        >
                          {row.Change != null ? (
                            <span className="rate-badge">
                              {isPositive ? "+" : ""}
                              {(row.Change * 100).toFixed(2)}%
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="align-right">
                          {formatNumber(row.Open)}원
                        </td>
                        <td className="align-right text-red">
                          {formatNumber(row.High)}원
                        </td>
                        <td className="align-right text-blue">
                          {formatNumber(row.Low)}원
                        </td>
                        <td className="align-right font-mono">
                          {formatNumber(row.Volume)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
