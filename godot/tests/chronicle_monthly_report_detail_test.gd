extends Node

const GameStateScript := preload("res://scripts/game_state.gd")

func _ready() -> void:
	var state: RefCounted = GameStateScript.new()
	state.set("turn_reports", [{
		"settled": true,
		"turn": 3,
		"year": 1627,
		"month": 11,
		"guoku_money_delta": 0,
		"guoku_grain_delta": 0,
		"neitang_money_delta": 0,
		"huangquan_delta": 0,
		"huangwei_delta": 0,
		"minxin_delta": 0,
		"liao_arrears_delta": 0,
		"jiubian_arrears_delta": 0,
		"liaodong_frontier_delta": 0,
		"population_registered_delta": 0,
		"population_hidden_delta": 0,
		"refugee_delta": 0,
		"events": [
			{"title": "辽东塘报", "name": "辽镇告急"}
		],
		"faction_ai_actions": [
			{
				"kind": "chahar_counterpressure",
				"faction": "察哈尔",
				"target_faction": "后金",
				"reason": "明廷援察哈尔牵制后金北翼"
			}
		],
		"uprisings": [
			{"faction": "陕西民变军", "region": "陕西", "reason": "饥民流徙成军"}
		],
		"military_alerts": ["辽西巡防吃紧"]
	}])

	var entries: Array = _array(state.call("chronicle_entries"))
	var report: Dictionary = _find_monthly_report(entries)
	if report.is_empty():
		_fail("Chronicle did not create monthly report entry")
		return
	var details: String = str(report.get("details", ""))
	if not details.contains("辽东塘报") or not details.contains("辽镇告急"):
		_fail("Chronicle monthly details omitted concrete event names")
		return
	if not details.contains("察哈尔") or not details.contains("明廷援察哈尔牵制后金北翼"):
		_fail("Chronicle monthly details omitted concrete faction AI reasons")
		return
	if not details.contains("陕西民变军") or not details.contains("饥民流徙成军"):
		_fail("Chronicle monthly details omitted concrete uprising reasons")
		return
	if not details.contains("辽西巡防吃紧"):
		_fail("Chronicle monthly details omitted military alert text")
		return

	print("[TianmingGodotTest] chronicle monthly report detail test passed")
	_finish(0)

func _find_monthly_report(entries: Array) -> Dictionary:
	for raw in entries:
		var entry: Dictionary = _dict(raw)
		if str(entry.get("kind", "")) == "monthly_report":
			return entry
	return {}

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _dict(value: Variant) -> Dictionary:
	return value if typeof(value) == TYPE_DICTIONARY else {}

func _fail(message: String) -> void:
	print("[TianmingGodotTest] chronicle monthly report detail test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] chronicle monthly report detail test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
