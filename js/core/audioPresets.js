(function(){
  'use strict';

  const presets = {
  "sfx": {
    "ui": {
      "throttle": 0.08,
      "layers": [
        {
          "kind": "tone",
          "frequency": 520,
          "duration": 0.07,
          "wave": "triangle",
          "gain": 0.08,
          "delay": 0,
          "slide": 160
        },
        {
          "kind": "tone",
          "frequency": 780,
          "duration": 0.08,
          "wave": "triangle",
          "gain": 0.06,
          "delay": 0.04,
          "slide": 120
        }
      ]
    },
    "dash": {
      "throttle": 0.16,
      "layers": [
        {
          "kind": "noise",
          "duration": 0.18,
          "gain": 0.13,
          "delay": 0,
          "filterFreq": 1200,
          "filterType": "highpass"
        },
        {
          "kind": "tone",
          "frequency": 220,
          "duration": 0.16,
          "wave": "sawtooth",
          "gain": 0.07,
          "delay": 0,
          "slide": 520
        }
      ]
    },
    "boost": {
      "throttle": 0.14,
      "layers": [
        {
          "kind": "noise",
          "duration": 0.12,
          "gain": 0.07,
          "delay": 0,
          "filterFreq": 1500,
          "filterType": "highpass"
        },
        {
          "kind": "tone",
          "frequency": 160,
          "duration": 0.12,
          "wave": "sawtooth",
          "gain": 0.035,
          "delay": 0,
          "slide": 80
        }
      ]
    },
    "playerHit": {
      "throttle": 0.16,
      "layers": [
        {
          "kind": "noise",
          "duration": 0.18,
          "gain": 0.22,
          "delay": 0,
          "filterFreq": 520,
          "filterType": "lowpass"
        },
        {
          "kind": "tone",
          "frequency": 86,
          "duration": 0.18,
          "wave": "sawtooth",
          "gain": 0.12,
          "delay": 0,
          "slide": -36
        },
        {
          "kind": "tone",
          "frequency": 44,
          "duration": 0.24,
          "wave": "sine",
          "gain": 0.08,
          "delay": 0.03,
          "slide": -8
        }
      ]
    },
    "hit": {
      "throttle": 0.18,
      "layers": [
        {
          "kind": "noise",
          "duration": 0.12,
          "gain": 0.16,
          "delay": 0,
          "filterFreq": 650,
          "filterType": "lowpass"
        },
        {
          "kind": "tone",
          "frequency": 110,
          "duration": 0.08,
          "wave": "sawtooth",
          "gain": 0.06,
          "delay": 0,
          "slide": -45
        }
      ]
    },
    "pickup": {
      "throttle": 0.06,
      "layers": [
        {
          "kind": "tone",
          "frequency": 720,
          "duration": 0.08,
          "wave": "sine",
          "gain": 0.055,
          "delay": 0,
          "slide": 160
        },
        {
          "kind": "tone",
          "frequency": 980,
          "duration": 0.07,
          "wave": "sine",
          "gain": 0.045,
          "delay": 0.05,
          "slide": 120
        }
      ]
    },
    "heal": {
      "layers": [
        {
          "kind": "tone",
          "frequency": 520,
          "duration": 0.12,
          "wave": "sine",
          "gain": 0.07,
          "delay": 0,
          "slide": 180
        },
        {
          "kind": "tone",
          "frequency": 840,
          "duration": 0.16,
          "wave": "sine",
          "gain": 0.06,
          "delay": 0.06,
          "slide": 220
        }
      ]
    },
    "level": {
      "layers": [
        {
          "kind": "tone",
          "frequency": 480,
          "duration": 0.12,
          "wave": "triangle",
          "gain": 0.09,
          "delay": 0,
          "slide": 180
        },
        {
          "kind": "tone",
          "frequency": 720,
          "duration": 0.12,
          "wave": "triangle",
          "gain": 0.08,
          "delay": 0.08,
          "slide": 220
        },
        {
          "kind": "tone",
          "frequency": 1080,
          "duration": 0.18,
          "wave": "triangle",
          "gain": 0.07,
          "delay": 0.16,
          "slide": 120
        }
      ]
    },
    "boss": {
      "layers": [
        {
          "kind": "noise",
          "duration": 0.45,
          "gain": 0.17,
          "delay": 0,
          "filterFreq": 220,
          "filterType": "lowpass"
        },
        {
          "kind": "tone",
          "frequency": 72,
          "duration": 0.5,
          "wave": "sawtooth",
          "gain": 0.11,
          "delay": 0,
          "slide": -24
        }
      ]
    },
    "explode": {
      "throttle": 0.06,
      "layers": [
        {
          "kind": "noise",
          "duration": 0.32,
          "gain": 0.2,
          "delay": 0,
          "filterFreq": 420,
          "filterType": "lowpass"
        },
        {
          "kind": "tone",
          "frequency": 90,
          "duration": 0.18,
          "wave": "sawtooth",
          "gain": 0.08,
          "delay": 0,
          "slide": -40
        }
      ]
    },
    "laser": {
      "throttle": 0.035,
      "layers": [
        {
          "kind": "tone",
          "frequency": 880,
          "duration": 0.07,
          "wave": "square",
          "gain": 0.055,
          "delay": 0,
          "slide": -420
        },
        {
          "kind": "tone",
          "frequency": 1320,
          "duration": 0.045,
          "wave": "sawtooth",
          "gain": 0.035,
          "delay": 0,
          "slide": -600
        }
      ]
    },
    "missile": {
      "throttle": 0.09,
      "layers": [
        {
          "kind": "noise",
          "duration": 0.13,
          "gain": 0.09,
          "delay": 0,
          "filterFreq": 900,
          "filterType": "bandpass"
        },
        {
          "kind": "tone",
          "frequency": 210,
          "duration": 0.16,
          "wave": "sawtooth",
          "gain": 0.055,
          "delay": 0,
          "slide": 70
        }
      ]
    },
    "homing": {
      "throttle": 0.07,
      "layers": [
        {
          "kind": "tone",
          "frequency": 780,
          "duration": 0.06,
          "wave": "triangle",
          "gain": 0.035,
          "delay": 0,
          "slide": 260
        },
        {
          "kind": "noise",
          "duration": 0.05,
          "gain": 0.035,
          "delay": 0,
          "filterFreq": 2100,
          "filterType": "highpass"
        }
      ]
    },
    "rail": {
      "layers": [
        {
          "kind": "tone",
          "frequency": 1300,
          "duration": 0.09,
          "wave": "sawtooth",
          "gain": 0.08,
          "delay": 0,
          "slide": -900
        },
        {
          "kind": "noise",
          "duration": 0.1,
          "gain": 0.08,
          "delay": 0,
          "filterFreq": 1800,
          "filterType": "highpass"
        }
      ]
    },
    "chain": {
      "throttle": 0.12,
      "layers": [
        {
          "kind": "tone",
          "frequency": 900,
          "duration": 0.045,
          "wave": "square",
          "gain": 0.045,
          "delay": 0,
          "slide": 260
        },
        {
          "kind": "tone",
          "frequency": 1180,
          "duration": 0.045,
          "wave": "square",
          "gain": 0.04,
          "delay": 0.04,
          "slide": -180
        },
        {
          "kind": "tone",
          "frequency": 1500,
          "duration": 0.04,
          "wave": "square",
          "gain": 0.035,
          "delay": 0.08,
          "slide": -240
        }
      ]
    },
    "beam": {
      "throttle": 0.18,
      "layers": [
        {
          "kind": "tone",
          "frequency": 620,
          "duration": 0.22,
          "wave": "sawtooth",
          "gain": 0.06,
          "delay": 0,
          "slide": 80
        },
        {
          "kind": "tone",
          "frequency": 1240,
          "duration": 0.18,
          "wave": "sine",
          "gain": 0.04,
          "delay": 0,
          "slide": -120
        }
      ]
    },
    "mine": {
      "layers": [
        {
          "kind": "tone",
          "frequency": 420,
          "duration": 0.08,
          "wave": "triangle",
          "gain": 0.06,
          "delay": 0,
          "slide": 120
        },
        {
          "kind": "tone",
          "frequency": 260,
          "duration": 0.08,
          "wave": "triangle",
          "gain": 0.045,
          "delay": 0.06,
          "slide": -80
        }
      ]
    },
    "enemyKill": {
      "throttle": 0.045,
      "layers": [
        {
          "kind": "noise",
          "duration": 0.2,
          "gain": 0.16,
          "delay": 0,
          "filterFreq": 1900,
          "filterType": "highpass"
        },
        {
          "kind": "noise",
          "duration": 0.18,
          "gain": 0.11,
          "delay": 0.03,
          "filterFreq": 520,
          "filterType": "lowpass"
        },
        {
          "kind": "tone",
          "frequency": 520,
          "duration": 0.07,
          "wave": "triangle",
          "gain": 0.05,
          "delay": 0,
          "slide": -220
        },
        {
          "kind": "tone",
          "frequency": 260,
          "duration": 0.09,
          "wave": "square",
          "gain": 0.04,
          "delay": 0.03,
          "slide": -110
        },
        {
          "kind": "tone",
          "frequency": 120,
          "duration": 0.12,
          "wave": "sawtooth",
          "gain": 0.035,
          "delay": 0.02,
          "slide": -40
        }
      ]
    }
  },
  "weapon": {
    "thunderLance": {
      "throttle": 0.07,
      "layers": [
        {
          "kind": "tone",
          "frequency": 620,
          "duration": 0.07,
          "wave": "square",
          "gain": 0.045,
          "delay": 0,
          "slide": 260
        },
        {
          "kind": "tone",
          "frequency": 1240,
          "duration": 0.045,
          "wave": "sawtooth",
          "gain": 0.028,
          "delay": 0.025,
          "slide": -520
        }
      ]
    },
    "starSword": {
      "throttle": 0.11,
      "layers": [
        {
          "kind": "noise",
          "duration": 0.09,
          "gain": 0.055,
          "delay": 0,
          "filterFreq": 1750,
          "filterType": "highpass"
        },
        {
          "kind": "tone",
          "frequency": 520,
          "duration": 0.08,
          "wave": "triangle",
          "gain": 0.046,
          "delay": 0,
          "slide": -210
        }
      ]
    },
    "moonBlade": {
      "throttle": 0.14,
      "layers": [
        {
          "kind": "tone",
          "frequency": 610,
          "duration": 0.15,
          "wave": "triangle",
          "gain": 0.04,
          "delay": 0,
          "slide": 240
        },
        {
          "kind": "tone",
          "frequency": 920,
          "duration": 0.11,
          "wave": "sine",
          "gain": 0.026,
          "delay": 0.035,
          "slide": -160
        }
      ]
    },
    "shadowDagger": {
      "throttle": 0.07,
      "layers": [
        {
          "kind": "tone",
          "frequency": 760,
          "duration": 0.055,
          "wave": "triangle",
          "gain": 0.032,
          "delay": 0,
          "slide": 220
        },
        {
          "kind": "noise",
          "duration": 0.045,
          "gain": 0.03,
          "delay": 0,
          "filterFreq": 2300,
          "filterType": "highpass"
        }
      ]
    },
    "frostRing": {
      "throttle": 0.42,
      "layers": [
        {
          "kind": "tone",
          "frequency": 820,
          "duration": 0.22,
          "wave": "sine",
          "gain": 0.036,
          "delay": 0,
          "slide": 180
        },
        {
          "kind": "tone",
          "frequency": 1260,
          "duration": 0.2,
          "wave": "triangle",
          "gain": 0.026,
          "delay": 0.045,
          "slide": -160
        },
        {
          "kind": "noise",
          "duration": 0.13,
          "gain": 0.028,
          "delay": 0,
          "filterFreq": 2800,
          "filterType": "highpass"
        }
      ]
    },
    "holyPrism": {
      "throttle": 0.38,
      "layers": [
        {
          "kind": "tone",
          "frequency": 540,
          "duration": 0.18,
          "wave": "sine",
          "gain": 0.036,
          "delay": 0,
          "slide": 360
        },
        {
          "kind": "tone",
          "frequency": 1080,
          "duration": 0.16,
          "wave": "triangle",
          "gain": 0.026,
          "delay": 0.05,
          "slide": -220
        }
      ]
    },
    "dragonBreath": {
      "throttle": 0.09,
      "layers": [
        {
          "kind": "noise",
          "duration": 0.16,
          "gain": 0.085,
          "delay": 0,
          "filterFreq": 880,
          "filterType": "bandpass"
        },
        {
          "kind": "tone",
          "frequency": 120,
          "duration": 0.08,
          "wave": "sawtooth",
          "gain": 0.028,
          "delay": 0,
          "slide": 28
        }
      ]
    },
    "meteorStaff": {
      "throttle": 0.6,
      "layers": [
        {
          "kind": "noise",
          "duration": 0.42,
          "gain": 0.14,
          "delay": 0,
          "filterFreq": 260,
          "filterType": "lowpass"
        },
        {
          "kind": "tone",
          "frequency": 96,
          "duration": 0.34,
          "wave": "sawtooth",
          "gain": 0.075,
          "delay": 0,
          "slide": -42
        },
        {
          "kind": "tone",
          "frequency": 420,
          "duration": 0.18,
          "wave": "triangle",
          "gain": 0.032,
          "delay": 0.1,
          "slide": -160
        }
      ]
    },
    "poisonVine": {
      "throttle": 0.35,
      "layers": [
        {
          "kind": "tone",
          "frequency": 180,
          "duration": 0.22,
          "wave": "sine",
          "gain": 0.038,
          "delay": 0,
          "slide": -30
        },
        {
          "kind": "noise",
          "duration": 0.22,
          "gain": 0.045,
          "delay": 0,
          "filterFreq": 700,
          "filterType": "bandpass"
        }
      ]
    },
    "voidHole": {
      "throttle": 1.2,
      "layers": [
        {
          "kind": "tone",
          "frequency": 58,
          "duration": 0.8,
          "wave": "sawtooth",
          "gain": 0.085,
          "delay": 0,
          "slide": -12
        },
        {
          "kind": "tone",
          "frequency": 116,
          "duration": 0.7,
          "wave": "sine",
          "gain": 0.046,
          "delay": 0,
          "slide": -20
        },
        {
          "kind": "noise",
          "duration": 0.45,
          "gain": 0.075,
          "delay": 0,
          "filterFreq": 240,
          "filterType": "lowpass"
        }
      ]
    },
    "missilePod": {
      "throttle": 0.09,
      "layers": [
        {
          "kind": "noise",
          "duration": 0.13,
          "gain": 0.086,
          "delay": 0,
          "filterFreq": 900,
          "filterType": "bandpass"
        },
        {
          "kind": "tone",
          "frequency": 210,
          "duration": 0.16,
          "wave": "sawtooth",
          "gain": 0.052,
          "delay": 0,
          "slide": 70
        }
      ]
    },
    "railCannon": {
      "throttle": 0.22,
      "layers": [
        {
          "kind": "tone",
          "frequency": 1320,
          "duration": 0.09,
          "wave": "sawtooth",
          "gain": 0.075,
          "delay": 0,
          "slide": -900
        },
        {
          "kind": "noise",
          "duration": 0.1,
          "gain": 0.072,
          "delay": 0,
          "filterFreq": 1800,
          "filterType": "highpass"
        }
      ]
    },
    "arcEmitter": {
      "throttle": 0.12,
      "layers": [
        {
          "kind": "tone",
          "frequency": 900,
          "duration": 0.045,
          "wave": "square",
          "gain": 0.043,
          "delay": 0,
          "slide": 260
        },
        {
          "kind": "tone",
          "frequency": 1180,
          "duration": 0.045,
          "wave": "square",
          "gain": 0.038,
          "delay": 0.04,
          "slide": -180
        },
        {
          "kind": "tone",
          "frequency": 1500,
          "duration": 0.04,
          "wave": "square",
          "gain": 0.032,
          "delay": 0.08,
          "slide": -240
        }
      ]
    },
    "mineLayer": {
      "throttle": 0.18,
      "layers": [
        {
          "kind": "tone",
          "frequency": 420,
          "duration": 0.08,
          "wave": "triangle",
          "gain": 0.057,
          "delay": 0,
          "slide": 120
        },
        {
          "kind": "tone",
          "frequency": 260,
          "duration": 0.08,
          "wave": "triangle",
          "gain": 0.042,
          "delay": 0.06,
          "slide": -80
        }
      ]
    },
    "beamCore": {
      "throttle": 0.18,
      "layers": [
        {
          "kind": "tone",
          "frequency": 620,
          "duration": 0.22,
          "wave": "sawtooth",
          "gain": 0.055,
          "delay": 0,
          "slide": 80
        },
        {
          "kind": "tone",
          "frequency": 1240,
          "duration": 0.18,
          "wave": "sine",
          "gain": 0.036,
          "delay": 0,
          "slide": -120
        }
      ]
    },
    "frostMissile": {
      "throttle": 0.11,
      "layers": [
        {
          "kind": "noise",
          "duration": 0.12,
          "gain": 0.07,
          "delay": 0,
          "filterFreq": 1700,
          "filterType": "bandpass"
        },
        {
          "kind": "tone",
          "frequency": 340,
          "duration": 0.16,
          "wave": "triangle",
          "gain": 0.046,
          "delay": 0,
          "slide": 150
        },
        {
          "kind": "tone",
          "frequency": 920,
          "duration": 0.07,
          "wave": "sine",
          "gain": 0.024,
          "delay": 0.05,
          "slide": -220
        }
      ]
    },
    "rageMinigun": {
      "throttle": 0.045,
      "layers": [
        {
          "kind": "tone",
          "frequency": 980,
          "duration": 0.035,
          "wave": "square",
          "gain": 0.04,
          "delay": 0,
          "slide": -360
        },
        {
          "kind": "noise",
          "duration": 0.035,
          "gain": 0.025,
          "delay": 0,
          "filterFreq": 2600,
          "filterType": "highpass"
        }
      ]
    },
    "energyTurret": {
      "throttle": 0.22,
      "layers": [
        {
          "kind": "tone",
          "frequency": 360,
          "duration": 0.08,
          "wave": "triangle",
          "gain": 0.052,
          "delay": 0,
          "slide": 180
        },
        {
          "kind": "tone",
          "frequency": 210,
          "duration": 0.1,
          "wave": "sawtooth",
          "gain": 0.038,
          "delay": 0.05,
          "slide": -60
        }
      ]
    },
    "shadowFleet": {
      "throttle": 0.12,
      "layers": [
        {
          "kind": "tone",
          "frequency": 520,
          "duration": 0.07,
          "wave": "triangle",
          "gain": 0.036,
          "delay": 0,
          "slide": 260
        },
        {
          "kind": "noise",
          "duration": 0.07,
          "gain": 0.032,
          "delay": 0,
          "filterFreq": 2000,
          "filterType": "highpass"
        }
      ]
    },
    "plasmaRay": {
      "throttle": 0.07,
      "layers": [
        {
          "kind": "tone",
          "frequency": 1180,
          "duration": 0.06,
          "wave": "sawtooth",
          "gain": 0.047,
          "delay": 0,
          "slide": -420
        },
        {
          "kind": "tone",
          "frequency": 560,
          "duration": 0.08,
          "wave": "square",
          "gain": 0.027,
          "delay": 0.01,
          "slide": 180
        }
      ]
    }
  }
};

  window.GameAudioPresets = presets;
  window.GameAudioDefaultPresets = JSON.parse(JSON.stringify(presets));
})();
