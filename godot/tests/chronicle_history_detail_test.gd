extends Node

const GameStateScript := preload("res://scripts/game_state.gd")

func _ready() -> void:
	var state: RefCounted = GameStateScript.new()
	state.set("turn", 8)
	state.set("year", 1627)
	state.set("month", 10)
	state.set("diplomacy_history", [{
		"turn": 8,
		"year": 1627,
		"month": 10,
		"id": "send_envoy",
		"name": "遣使修好",
		"cost": 1,
		"target_faction": "后金",
		"applied": {
			"treasury_money": -3,
			"imperial_prestige": 2
		},
		"faction_applied": {
			"relation_to_player": 6,
			"hostility": -4
		}
	}])
	state.set("issued_edicts", [{
		"turn": 8,
		"year": 1627,
		"month": 10,
		"id": "reduce_regional_levy",
		"name": "减派蠲税",
		"cost": 1,
		"target_region": "陕西",
		"applied": {
			"huangwei": 1
		},
		"region_applied": {
			"mood": 5,
			"unrest": -3
		}
	}])
	state.set("appointment_history", [{
		"turn": 8,
		"year": 1627,
		"month": 10,
		"office": "兵部尚书",
		"character": "孙承宗",
		"old_holder": "崔呈秀",
		"old_title": "蓟辽督师",
		"loyalty_delta": 5
	}])

	var entries: Array = _array(state.call("chronicle_entries"))
	var diplomacy: Dictionary = _find_kind(entries, "diplomacy")
	if diplomacy.is_empty():
		_fail("Chronicle omitted diplomacy history")
		return
	var diplomacy_details: String = str(diplomacy.get("details", ""))
	if not diplomacy_details.contains("朝廷") or not diplomacy_details.contains("国库银") or not diplomacy_details.contains("皇威"):
		_fail("Chronicle diplomacy details omitted player-facing national effects")
		return
	if not diplomacy_details.contains("势力") or not diplomacy_details.contains("对明关系") or not diplomacy_details.contains("敌意"):
		_fail("Chronicle diplomacy details omitted target-faction effects")
		return
	if diplomacy_details.contains("treasury_money") or diplomacy_details.contains("relation_to_player"):
		_fail("Chronicle diplomacy details leaked internal effect keys")
		return

	var edict: Dictionary = _find_kind(entries, "edict")
	if edict.is_empty():
		_fail("Chronicle omitted edict history")
		return
	var edict_details: String = str(edict.get("details", ""))
	if not edict_details.contains("朝廷") or not edict_details.contains("皇威"):
		_fail("Chronicle edict details omitted national effects")
		return
	if not edict_details.contains("地块") or not edict_details.contains("民心") or not edict_details.contains("不稳"):
		_fail("Chronicle edict details omitted region effects")
		return

	var appointment: Dictionary = _find_kind(entries, "appointment")
	if appointment.is_empty():
		_fail("Chronicle omitted appointment history")
		return
	var appointment_details: String = str(appointment.get("details", ""))
	if not appointment_details.contains("孙承宗") or not appointment_details.contains("兵部尚书"):
		_fail("Chronicle appointment details omitted new holder")
		return
	if not appointment_details.contains("崔呈秀") or not appointment_details.contains("蓟辽督师") or not appointment_details.contains("忠诚"):
		_fail("Chronicle appointment details omitted previous holder or loyalty change")
		return

	print("[TianmingGodotTest] chronicle history detail scene test passed")
	_finish(0)

func _find_kind(entries: Array, kind: String) -> Dictionary:
	for raw in entries:
		var entry: Dictionary = _dict(raw)
		if str(entry.get("kind", "")) == kind:
			return entry
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] chronicle history detail scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] chronicle history detail scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
