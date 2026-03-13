"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateEvent() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [deadline, setDeadline] = useState("");
  const [finalCandidateDates, setFinalCandidateDates] = useState<string[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [viewDate, setViewDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );

  const changeMonth = (offset: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const createAndShareEvent = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/events/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          password,
          deadline,
          candidate_dates: finalCandidateDates,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "イベント作成に失敗しました。");
      }

      const eventId = data.id;
      const shareUrl = `${window.location.origin}/event/${eventId}`;

      if (navigator.share) {
        try {
          await navigator.share({
            title,
            text: `イベント「${title}」の日程調整をお願いします！`,
            url: shareUrl,
          });
        } catch {
          await navigator.clipboard.writeText(shareUrl);
        }
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("URLをコピーしました！友達に送ってください。");
      }

      router.push(`/event/${eventId}`);
    } catch (error: any) {
      alert(error?.message || "作成に失敗しました。");
      setIsSubmitting(false);
    }
  };

  if (!isConfirming) {
    return (
      <main
        style={{
          padding: "20px",
          maxWidth: "450px",
          margin: "0 auto",
          color: "black",
          backgroundColor: "white",
          minHeight: "100vh",
          fontFamily: "sans-serif",
        }}
      >
        <h1 style={{ textAlign: "center", fontSize: "22px" }}>📅 予定調整くん</h1>
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <section>
            <label style={{ fontWeight: "bold" }}>1. イベント名</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #ccc" }}
            />
          </section>

          <section>
            <label style={{ fontWeight: "bold" }}>2. イベント詳細（場所・予算など）</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid #ccc",
                minHeight: "80px",
                marginTop: "5px",
              }}
            />
          </section>

          <section>
            <label style={{ fontWeight: "bold" }}>3. パスワード & 期限</label>
            <div style={{ display: "flex", gap: "10px", marginTop: "5px" }}>
              <input
                type="password"
                placeholder="パスワード"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid #ccc" }}
              />
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "1px solid #ccc" }}
              />
            </div>
          </section>

          <section style={{ border: "1px solid #eee", padding: "15px", borderRadius: "15px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <label style={{ fontWeight: "bold" }}>4. 候補日を選択</label>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  style={{
                    border: "none",
                    background: "#f0f0f0",
                    padding: "5px 12px",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  ＜
                </button>
                <span style={{ fontSize: "14px", fontWeight: "bold", minWidth: "100px", textAlign: "center" }}>
                  {viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月
                </span>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  style={{
                    border: "none",
                    background: "#f0f0f0",
                    padding: "5px 12px",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  ＞
                </button>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "5px", textAlign: "center" }}>
              {["日", "月", "火", "水", "木", "金", "土"].map((w, i) => (
                <div
                  key={w}
                  style={{
                    fontSize: "12px",
                    color: i === 0 ? "#e53e3e" : i === 6 ? "#3182ce" : "#999",
                    paddingBottom: "5px",
                  }}
                >
                  {w}
                </div>
              ))}
              {(() => {
                const year = viewDate.getFullYear();
                const month = viewDate.getMonth();
                const firstDayOfMonth = new Date(year, month, 1).getDay();
                const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
                const days = [];
                for (let i = 0; i < firstDayOfMonth; i++) days.push(<div key={`empty-${i}`} />);
                for (let d = 1; d <= lastDateOfMonth; d++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                  const isSelected = finalCandidateDates.includes(dateStr);
                  days.push(
                    <div
                      key={dateStr}
                      onClick={() => {
                        if (isSelected) setFinalCandidateDates(finalCandidateDates.filter((item) => item !== dateStr));
                        else setFinalCandidateDates([...finalCandidateDates, dateStr]);
                      }}
                      style={{
                        padding: "10px 0",
                        borderRadius: "8px",
                        backgroundColor: isSelected ? "#333" : "white",
                        color: isSelected ? "white" : "black",
                        border: "1px solid #eee",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: isSelected ? "bold" : "normal",
                        transition: "0.1s",
                      }}
                    >
                      {d}
                    </div>
                  );
                }
                return days;
              })()}
            </div>
          </section>

          <button
            type="button"
            onClick={() => {
              if (!title || !password || !deadline || finalCandidateDates.length === 0) {
                return alert("入力が足りません");
              }
              setIsConfirming(true);
            }}
            style={{
              padding: "18px",
              backgroundColor: "#000",
              color: "white",
              borderRadius: "12px",
              fontWeight: "bold",
              border: "none",
              cursor: "pointer",
            }}
          >
            確認画面へ
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      style={{
        padding: "20px",
        maxWidth: "450px",
        margin: "0 auto",
        backgroundColor: "white",
        color: "black",
        minHeight: "100vh",
        fontFamily: "sans-serif",
      }}
    >
      <h2 style={{ textAlign: "center" }}>📝 最終確認</h2>
      <div style={{ border: "1px solid #eee", padding: "20px", borderRadius: "15px", marginTop: "20px" }}>
        <p><strong>イベント名:</strong> {title}</p>
        <p style={{ fontSize: "14px", color: "#666" }}><strong>詳細:</strong> {description || "なし"}</p>
        <p><strong>回答期限:</strong> {deadline}</p>
        <p><strong>候補日:</strong> {finalCandidateDates.length}件</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "10px" }}>
          {finalCandidateDates.sort().map((d) => {
            const dateObj = new Date(d);
            return (
              <span
                key={d}
                style={{
                  fontSize: "12px",
                  backgroundColor: "#f0f0f0",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  border: "1px solid #e0e0e0",
                }}
              >
                {dateObj.getMonth() + 1}/{dateObj.getDate()}
              </span>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px" }}>
        <button
          type="button"
          onClick={createAndShareEvent}
          disabled={isSubmitting}
          style={{
            padding: "18px",
            backgroundColor: "#28a745",
            color: "white",
            borderRadius: "12px",
            border: "none",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          {isSubmitting ? "作成中..." : "発行して共有する"}
        </button>
        <button
          type="button"
          onClick={() => setIsConfirming(false)}
          style={{
            padding: "12px",
            border: "none",
            background: "none",
            color: "#666",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          修正する
        </button>
      </div>
    </main>
  );
}