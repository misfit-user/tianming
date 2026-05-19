extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const SaveManagerScript := preload("res://scripts/save_manager.gd")

var save_manager: RefCounted
var slot_id: String = "codex_summary"

func _ready() -> void:
	save_manager = SaveManagerScript.new()
	save_manager.call("delete_slot", slot_id)

	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	if not load_result.get("ok", false):
		_fail("Scenario load failed: %s" % str(load_result.get("error", "")))
		return
	var state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return
	state.call("perform_player_action", "open_neitang_liaoxiang")

	var save_result: Dictionary = save_manager.call("save_to_slot", state, slot_id)
	if not save_result.get("ok", false):
		_fail("Save to slot failed: %s" % str(save_result.get("error", "")))
		return
	var metadata: Dictionary = save_manager.call("slot_metadata", slot_id)
	if not bool(metadata.get("exists", false)):
		_fail("Saved slot metadata did not report an existing save")
		return
	if not metadata.has("action_points") or int(metadata.get("action_points", -1)) != int(state.get("action_points")):
		_fail("Save metadata did not include current action points")
		return
	if not metadata.has("treasury_money") or not is_equal_approx(float(metadata.get("treasury_money", 0.0)), float(state.get("guoku_money"))):
		_fail("Save metadata did not include treasury money")
		return
	if not metadata.has("huangwei") or not metadata.has("minxin"):
		_fail("Save metadata did not include authority/public sentiment summary fields")
		return
	if str(metadata.get("summary_text", "")).is_empty():
		_fail("Save metadata did not include a player-facing summary text")
		return

	save_manager.call("delete_slot", slot_id)
	print("[TianmingGodotTest] save slot summary metadata scene test passed")
	_finish(0)

func _fail(message: String) -> void:
	if save_manager != null:
		save_manager.call("delete_slot", slot_id)
	print("[TianmingGodotTest] save slot summary metadata scene test failed: %s" % message)
	push_error(message)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] save slot summary metadata scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
