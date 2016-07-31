"use strict";

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

Primrose.InputProcessor = function () {
  "use strict";

  var SETTINGS_TO_ZERO = ["heading", "pitch", "roll", "pointerPitch", "headX", "headY", "headZ"],
      TELEPORT_PAD_RADIUS = 0.4,
      FORWARD = new THREE.Vector3(0, 0, -1),
      MAX_SELECT_DISTANCE = 2,
      MAX_SELECT_DISTANCE_SQ = MAX_SELECT_DISTANCE * MAX_SELECT_DISTANCE,
      MAX_MOVE_DISTANCE = 5,
      MAX_MOVE_DISTANCE_SQ = MAX_MOVE_DISTANCE * MAX_MOVE_DISTANCE,
      LASER_WIDTH = 0.01,
      LASER_LENGTH = 3 * LASER_WIDTH,
      moveTo = new THREE.Vector3(0, 0, 0);

  pliny.class({
    parent: "Primrose",
    name: "InputProcessor",
    description: "| [under construction]"
  });

  var InputProcessor = function () {
    _createClass(InputProcessor, null, [{
      key: "defineAxisProperties",
      value: function defineAxisProperties(classFunc, values) {
        classFunc.AXES = values;
        values.forEach(function (name, i) {
          classFunc[name] = i + 1;
          Object.defineProperty(classFunc.prototype, name, {
            get: function get() {
              return this.getAxis(name);
            },
            set: function set(v) {
              this.setAxis(name, v);
            }
          });
        });
      }
    }]);

    function InputProcessor(name, parent, commands, socket, axisNames) {
      var _this = this;

      _classCallCheck(this, InputProcessor);

      this.name = name;
      this.parent = parent;
      this.commands = {};
      this.commandNames = [];
      this.socket = socket;
      this.enabled = true;
      this.paused = false;
      this.ready = true;
      this.transmitting = true;
      this.receiving = true;
      this.socketReady = false;
      this.inPhysicalUse = false;
      this.inputState = {
        buttons: [],
        axes: [],
        ctrl: false,
        alt: false,
        shift: false,
        meta: false
      };
      this.lastState = "";
      this.listeners = {
        teleport: []
      };

      var readMetaKeys = function readMetaKeys(event) {
        for (var i = 0; i < Primrose.Keys.MODIFIER_KEYS.length; ++i) {
          var m = Primrose.Keys.MODIFIER_KEYS[i];
          _this.inputState[m] = event[m + "Key"];
        }
      };

      window.addEventListener("keydown", readMetaKeys, false);
      window.addEventListener("keyup", readMetaKeys, false);

      if (socket) {
        socket.on("open", function () {
          _this.socketReady = true;
          _this.inPhysicalUse = !_this.receiving;
        });
        socket.on(name, function (cmdState) {
          if (_this.receiving) {
            _this.inPhysicalUse = false;
            _this.decodeStateSnapshot(cmdState);
            _this.fireCommands();
          }
        });
        socket.on("close", function () {
          _this.inPhysicalUse = true;
          _this.socketReady = false;
        });
      }

      for (var cmdName in commands) {
        this.addCommand(cmdName, commands[cmdName]);
      }

      for (var i = 0; i < Primrose.Keys.MODIFIER_KEYS.length; ++i) {
        this.inputState[Primrose.Keys.MODIFIER_KEYS[i]] = false;
      }

      this.axisNames = axisNames || Primrose.Input[name] && Primrose.Input[name].AXES || [];

      for (var i = 0; i < this.axisNames.length; ++i) {
        this.inputState.axes[i] = 0;
      }
    }

    _createClass(InputProcessor, [{
      key: "addCommand",
      value: function addCommand(name, cmd) {
        cmd.name = name;
        cmd = this.cloneCommand(cmd);
        if (typeof cmd.repetitions === "undefined") {
          cmd.repetitions = 1;
        }
        cmd.state = {
          value: null,
          pressed: false,
          wasPressed: false,
          fireAgain: false,
          lt: 0,
          ct: 0,
          repeatCount: 0
        };
        this.commands[name] = cmd;
        this.commandNames.push(name);
      }
    }, {
      key: "addEventListener",
      value: function addEventListener(evt, thunk, bubbles) {
        if (this.listeners[evt]) {
          this.listeners[evt].push(thunk);
        }
      }
    }, {
      key: "cloneCommand",
      value: function cloneCommand(cmd) {
        return {
          name: cmd.name,
          disabled: !!cmd.disabled,
          dt: cmd.dt || 0,
          deadzone: cmd.deadzone || 0,
          threshold: cmd.threshold || 0,
          repetitions: cmd.repetitions,
          scale: cmd.scale,
          offset: cmd.offset,
          min: cmd.min,
          max: cmd.max,
          integrate: cmd.integrate || false,
          delta: cmd.delta || false,
          axes: this.maybeClone(cmd.axes),
          commands: cmd.commands && cmd.commands.slice() || [],
          buttons: this.maybeClone(cmd.buttons),
          metaKeys: this.maybeClone(cmd.metaKeys && cmd.metaKeys.map(function (k) {
            for (var i = 0; i < Primrose.Keys.MODIFIER_KEYS.length; ++i) {
              var m = Primrose.Keys.MODIFIER_KEYS[i];
              if (Math.abs(k) === Primrose.Keys[m.toLocaleUpperCase()]) {
                return Math.sign(k) * (i + 1);
              }
            }
          })),
          commandDown: cmd.commandDown,
          commandUp: cmd.commandUp
        };
      }
    }, {
      key: "maybeClone",
      value: function maybeClone(arr) {
        var output = [];
        if (arr) {
          for (var i = 0; i < arr.length; ++i) {
            output[i] = {
              index: Math.abs(arr[i]) - 1,
              toggle: arr[i] < 0,
              sign: arr[i] < 0 ? -1 : 1
            };
          }
        }
        return output;
      }
    }, {
      key: "update",
      value: function update(dt) {
        if (this.enabled) {
          if (this.ready && this.enabled && this.inPhysicalUse && !this.paused && dt > 0) {
            for (var name in this.commands) {
              var cmd = this.commands[name];
              cmd.state.wasPressed = cmd.state.pressed;
              cmd.state.pressed = false;
              if (!cmd.disabled) {
                var metaKeysSet = true;

                if (cmd.metaKeys) {
                  for (var n = 0; n < cmd.metaKeys.length && metaKeysSet; ++n) {
                    var m = cmd.metaKeys[n];
                    metaKeysSet = metaKeysSet && (this.inputState[Primrose.Keys.MODIFIER_KEYS[m.index]] && !m.toggle || !this.inputState[Primrose.Keys.MODIFIER_KEYS[m.index]] && m.toggle);
                  }
                }

                if (metaKeysSet) {
                  var pressed = true,
                      value = 0,
                      n,
                      temp,
                      anyButtons = false;

                  for (n in this.inputState.buttons) {
                    if (this.inputState.buttons[n]) {
                      anyButtons = true;
                      break;
                    }
                  }

                  if (cmd.buttons) {
                    for (n = 0; n < cmd.buttons.length; ++n) {
                      var btn = cmd.buttons[n],
                          code = btn.index + 1,
                          p = code === Primrose.Keys.ANY && anyButtons || !!this.inputState.buttons[code];
                      temp = p ? btn.sign : 0;
                      pressed = pressed && (p && !btn.toggle || !p && btn.toggle);
                      if (Math.abs(temp) > Math.abs(value)) {
                        value = temp;
                      }
                    }
                  }

                  if (cmd.axes) {
                    for (n = 0; n < cmd.axes.length; ++n) {
                      var a = cmd.axes[n];
                      temp = a.sign * this.inputState.axes[a.index];
                      if (Math.abs(temp) > Math.abs(value)) {
                        value = temp;
                      }
                    }
                  }

                  for (n = 0; n < cmd.commands.length; ++n) {
                    temp = this.getValue(cmd.commands[n]);
                    if (Math.abs(temp) > Math.abs(value)) {
                      value = temp;
                    }
                  }

                  if (cmd.scale !== undefined) {
                    value *= cmd.scale;
                  }

                  if (cmd.offset !== undefined) {
                    value += cmd.offset;
                  }

                  if (cmd.deadzone && Math.abs(value) < cmd.deadzone) {
                    value = 0;
                  }

                  if (cmd.integrate) {
                    value = this.getValue(cmd.name) + value * dt;
                  } else if (cmd.delta) {
                    var ov = value;
                    if (cmd.state.lv !== undefined) {
                      value = (value - cmd.state.lv) / dt;
                    }
                    cmd.state.lv = ov;
                  }

                  if (cmd.min !== undefined) {
                    value = Math.max(cmd.min, value);
                  }

                  if (cmd.max !== undefined) {
                    value = Math.min(cmd.max, value);
                  }

                  if (cmd.threshold) {
                    pressed = pressed && value > cmd.threshold;
                  }

                  cmd.state.pressed = pressed;
                  cmd.state.value = value;
                }

                cmd.state.lt += dt;

                cmd.state.fireAgain = cmd.state.pressed && cmd.state.lt >= cmd.dt && (cmd.repetitions === -1 || cmd.state.repeatCount < cmd.repetitions);

                if (cmd.state.fireAgain) {
                  cmd.state.lt = 0;
                  ++cmd.state.repeatCount;
                } else if (!cmd.state.pressed) {
                  cmd.state.repeatCount = 0;
                }
              }
            }

            if (this.socketReady && this.transmitting) {
              var finalState = this.makeStateSnapshot();
              if (finalState !== this.lastState) {
                this.socket.emit(this.name, finalState);
                this.lastState = finalState;
              }
            }

            this.fireCommands();
          }
        }
      }
    }, {
      key: "zero",
      value: function zero() {
        for (var i = 0; this.enabled && i < SETTINGS_TO_ZERO.length; ++i) {
          this.setValue(SETTINGS_TO_ZERO[i], 0);
        }
      }
    }, {
      key: "fireCommands",
      value: function fireCommands() {
        if (this.ready && !this.paused) {
          for (var name in this.commands) {
            var cmd = this.commands[name];
            if (cmd.state.fireAgain && cmd.commandDown) {
              cmd.commandDown(this.name);
            }

            if (!cmd.state.pressed && cmd.state.wasPressed && cmd.commandUp) {
              cmd.commandUp(this.name);
            }
          }
        }
      }
    }, {
      key: "makeStateSnapshot",
      value: function makeStateSnapshot() {
        var state = "",
            i = 0,
            l = Object.keys(this.commands).length;
        for (var name in this.commands) {
          var cmd = this.commands[name];
          if (cmd.state) {
            state += i << 2 | (cmd.state.pressed ? 0x1 : 0) | (cmd.state.fireAgain ? 0x2 : 0) + ":" + cmd.state.value;
            if (i < l - 1) {
              state += "|";
            }
          }
          ++i;
        }
        return state;
      }
    }, {
      key: "decodeStateSnapshot",
      value: function decodeStateSnapshot(snapshot) {
        var cmd, name;
        for (name in this.commands) {
          cmd = this.commands[name];
          cmd.state.wasPressed = cmd.state.pressed;
        }
        var records = snapshot.split("|");
        for (var i = 0; i < records.length; ++i) {
          var record = records[i],
              parts = record.split(":"),
              cmdIndex = parseInt(parts[0], 10),
              pressed = (cmdIndex & 0x1) !== 0,
              fireAgain = (flags & 0x2) !== 0,
              flags = parseInt(parts[2], 10);
          cmdIndex >>= 2;
          name = this.commandNames(cmdIndex);
          cmd = this.commands[name];
          cmd.state = {
            value: parseFloat(parts[1]),
            pressed: pressed,
            fireAgain: fireAgain
          };
        }
      }
    }, {
      key: "setProperty",
      value: function setProperty(key, name, value) {
        if (this.commands[name]) {
          this.commands[name][key] = value;
        }
      }
    }, {
      key: "setDeadzone",
      value: function setDeadzone(name, value) {
        this.setProperty("deadzone", name, value);
      }
    }, {
      key: "setScale",
      value: function setScale(name, value) {
        this.setProperty("scale", name, value);
      }
    }, {
      key: "setDT",
      value: function setDT(name, value) {
        this.setProperty("dt", name, value);
      }
    }, {
      key: "setMin",
      value: function setMin(name, value) {
        this.setProperty("min", name, value);
      }
    }, {
      key: "setMax",
      value: function setMax(name, value) {
        this.setProperty("max", name, value);
      }
    }, {
      key: "addToArray",
      value: function addToArray(key, name, value) {
        if (this.commands[name] && this.commands[name][key]) {
          this.commands[name][key].push(value);
        }
      }
    }, {
      key: "addMetaKey",
      value: function addMetaKey(name, value) {
        this.addToArray("metaKeys", name, value);
      }
    }, {
      key: "addAxis",
      value: function addAxis(name, value) {
        this.addToArray("axes", name, value);
      }
    }, {
      key: "addButton",
      value: function addButton(name, value) {
        this.addToArray("buttons", name, value);
      }
    }, {
      key: "removeMetaKey",
      value: function removeMetaKey(name, value) {
        this.removeFromArray("metaKeys", name, value);
      }
    }, {
      key: "removeAxis",
      value: function removeAxis(name, value) {
        this.removeFromArray("axes", name, value);
      }
    }, {
      key: "removeButton",
      value: function removeButton(name, value) {
        this.removeFromArray("buttons", name, value);
      }
    }, {
      key: "invertAxis",
      value: function invertAxis(name, value) {
        this.invertInArray("axes", name, value);
      }
    }, {
      key: "invertButton",
      value: function invertButton(name, value) {
        this.invertInArray("buttons", name, value);
      }
    }, {
      key: "invertMetaKey",
      value: function invertMetaKey(name, value) {
        this.invertInArray("metaKeys", name, value);
      }
    }, {
      key: "removeFromArray",
      value: function removeFromArray(key, name, value) {
        if (this.commands[name] && this.commands[name][key]) {
          var arr = this.commands[name][key],
              n = arr.indexOf(value);
          if (n > -1) {
            arr.splice(n, 1);
          }
        }
      }
    }, {
      key: "invertInArray",
      value: function invertInArray(key, name, value) {
        if (this.commands[name] && this.commands[name][key]) {
          var arr = this.commands[name][key],
              n = arr.indexOf(value);
          if (n > -1) {
            arr[n] *= -1;
          }
        }
      }
    }, {
      key: "pause",
      value: function pause(v) {
        this.paused = v;
      }
    }, {
      key: "isPaused",
      value: function isPaused() {
        return this.paused;
      }
    }, {
      key: "enable",
      value: function enable(k, v) {
        if (v === undefined || v === null) {
          v = k;
          k = null;
        }

        if (k) {
          this.setProperty("disabled", k, !v);
        } else {
          this.enabled = v;
        }
      }
    }, {
      key: "isEnabled",
      value: function isEnabled(name) {
        return name && this.commands[name] && !this.commands[name].disabled;
      }
    }, {
      key: "transmit",
      value: function transmit(v) {
        this.transmitting = v;
      }
    }, {
      key: "isTransmitting",
      value: function isTransmitting() {
        return this.transmitting;
      }
    }, {
      key: "receive",
      value: function receive(v) {
        this.receiving = v;
      }
    }, {
      key: "isReceiving",
      value: function isReceiving() {
        return this.receiving;
      }
    }, {
      key: "getAxis",
      value: function getAxis(name) {
        var i = this.axisNames.indexOf(name);
        if (i > -1) {
          var value = this.inputState.axes[i] || 0;
          return value;
        }
        return null;
      }
    }, {
      key: "setAxis",
      value: function setAxis(name, value) {
        var i = this.axisNames.indexOf(name);
        if (i > -1) {
          this.inPhysicalUse = true;
          this.inputState.axes[i] = value;
        }
      }
    }, {
      key: "setButton",
      value: function setButton(index, pressed) {
        this.inPhysicalUse = true;
        this.inputState.buttons[index] = pressed;
      }
    }, {
      key: "getValue",
      value: function getValue(name) {
        return (this.enabled || this.receiving && this.socketReady) && this.isEnabled(name) && this.commands[name].state.value || this.getAxis(name) || 0;
      }
    }, {
      key: "setValue",
      value: function setValue(name, value) {
        var j = this.axisNames.indexOf(name);
        if (!this.commands[name] && j > -1) {
          this.setAxis(name, value);
        } else if (this.commands[name] && !this.commands[name].disabled) {
          this.commands[name].state.value = value;
        }
      }
    }, {
      key: "isDown",
      value: function isDown(name) {
        return (this.enabled || this.receiving && this.socketReady) && this.isEnabled(name) && this.commands[name].state.pressed;
      }
    }, {
      key: "isUp",
      value: function isUp(name) {
        return (this.enabled || this.receiving && this.socketReady) && this.isEnabled(name) && this.commands[name].state.pressed;
      }
    }]);

    return InputProcessor;
  }();

  return InputProcessor;
}();