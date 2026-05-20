import React, { useEffect } from "react";
// 1. FIXED: Removed the curly braces around Joyride!
import { Joyride } from "react-joyride";
import { useSettingsStore } from "../zustand/store";

export default function Tutorial() {
  const {
    runTutorial,
    hasSeenTutorial,
    startTutorial,
    finishTutorial,
    tutorialKey,
  } = useSettingsStore();

  useEffect(() => {
    // Only auto-start if they have NEVER seen it
    if (!hasSeenTutorial) {
      setTimeout(() => {
        startTutorial();
      }, 1500);
    }
  }, [hasSeenTutorial, startTutorial]);

  const handleJoyrideCallback = (data) => {
    // 2. FIXED: We now grab the 'action' as well as the 'status'
    const { status, action } = data;
    const finishedStatuses = ["finished", "skipped"];

    // 3. FIXED: If they finish it, skip it, OR close it early (hit X), save their progress!
    if (finishedStatuses.includes(status) || action === "close") {
      finishTutorial();
    }
  };

  const steps = [
    {
      target: ".tour-search-bar",
      title: "🔍 Suralarni qidirish",
      content: "Sura nomini lotin harflarida kiriting va surani tanglang ",
      disableBeacon: true,
      placement: "bottom",
    },
    {
      target: ".tour-heart-canvas",
      title: "🫀 Ko'rish uchun kursorni yurakka eting",
      content:
        "Sura haqida batafsil ma'lumot olish uchun yurakning bir bo'lagiga kursorni yaqinlashtiring",
      disableBeacon: true,
      placement: "center",
    },
    {
      target: ".tour-heart-canvas",
      title: "📖 O'qing va tinglang",
      content:
        "Qur'on suralarining go'zal qiroatini tinglash hamda o'qish uchun yurakning bir bo'lagiga bosing",
      disableBeacon: true,
      placement: "center",
    },
    {
      target: ".tour-heart-canvas",
      title: "❤️ Yuraginggizga hayot bag'ishlang",
      content:
        "Tanlangan surani yodlab tugating va surani yodladim yozuvini tanglang shunda yurakning tanlangan bo'lagi muzdan eriydi va asl holiga qaytib, urishni boshlaydi",
      disableBeacon: true,
      placement: "center",
    },
    // {
    //   target: ".tour-usage-button",
    //   title: "🔁 Replay Anytime",
    //   content: "Click this button whenever you want to see this tour again.",
    //   disableBeacon: true,
    //   placement: "bottom",
    // },
  ];

  return (
    <Joyride
      key={tutorialKey}
      disableScrolling={true}
      disableScrollParentFix={true} // Add this to stop it from looking for scroll parents
      spotlightClicks={true} //
      callback={handleJoyrideCallback}
      continuous={true}
      run={runTutorial}
      scrollToFirstStep={false}
      showProgress={true}
      showSkipButton={true}
      disableOverlayClose={true}
      locale={{
        next: "Davom etish",
        back: "Orqaga", // Replaces "Back"
        skip: "O'tkazib yuborish", // Replaces "Skip"
        last: "Boshlash",
      }}
      steps={steps}
      styles={{
        options: {
          arrowColor: "#f2ece1",
          backgroundColor: "#f2ece1",
          overlayColor: "rgba(10, 46, 31, 0.85)",
          primaryColor: "#d4af37",
          textColor: "#0f3b25",
          zIndex: 1000,
        },
        tooltipContainer: {
          textAlign: "left",
          fontFamily: "sans-serif",
          borderRadius: "12px",
          padding: "2px",
        },
        // tooltip: {
        //   textAlign: "left",
        //   fontFamily: "sans-serif",
        //   // borderRadius: "12px",
        //   padding: "5px",
        // },
        buttonNext: {
          fontWeight: "bold",
          borderRadius: "8px",
        },
        buttonBack: {
          color: "#0f3b25",
        },
        buttonPrimary: {
          background: "#1a2ecb",
        },
      }}
    />
  );
}
