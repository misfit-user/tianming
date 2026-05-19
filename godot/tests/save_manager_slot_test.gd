extends Node

const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")

var save_manager: RefCounted
var slot_id: String = "codex_roundtrip"

func _ready() -> void:
	var SaveManagerScript: Script = load("res://scripts/save_manager.gd")
	if SaveManagerScript == null:
		_fail("SaveManager script is missing")
		return
	save_manager = SaveManagerScript.new()
	if not save_manager.has_method("save_to_slot") or not save_manager.has_method("restore_slot") or not save_manager.has_method("slot_metadata"):
		_fail("SaveManager does not expose slot save/load API")
		return

	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	if not load_result.get("ok", false):
		_fail("Scenario load failed: %s" % str(load_result.get("error", "")))
		return
	var state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return

	var action_result: Dictionary = state.call("perform_player_action", "open_neitang_liaoxiang")
	if not action_result.get("ok", false):
		_fail("Preparing action failed: %s" % str(action_result.get("error", "")))
		return
	state.call("advance_month")
	var saved_turn: int = int(state.get("turn"))
	var saved_money: float = float(state.get("guoku_money"))
	var save_result: Dictionary = save_manager.call("save_to_slot", state, slot_id)
	if not save_result.get("ok", false):
		_fail("Save to slot failed: %s" % str(save_result.get("error", "")))
		return

	var metadata: Dictionary = save_manager.call("slot_metadata", slot_id)
	if not metadata.get("exists", false):
		_fail("Save slot metadata does not report an existing save")
		return
	if int(metadata.get("turn", 0)) != saved_turn or str(metadata.get("scenario_name", "")).is_empty():
		_fail("Save slot metadata did not preserve scenario and turn")
		return

	state.call("advance_month")
	if int(state.get("turn")) == saved_turn:
		_fail("Preparing changed state failed")
		return
	var restore_result: Dictionary = save_manager.call("restore_slot", state, slot_id)
	if not restore_result.get("ok", false):
		_fail("Restore slot failed: %s" % str(restore_result.get("error", "")))
		return
	if int(state.get("turn")) != saved_turn:
		_fail("Restored slot did not restore turn")
		return
	if not is_equal_approx(float(state.get("guoku_money")), saved_money):
		_fail("Restored slot did not restore treasury money")
		return
	if _array(state.get("action_history")).size() != 1:
		_fail("Restored slot did not restore action history")
		return

	var delete_result: Dictionary = save_manager.call("delete_slot", slot_id)
	if not delete_result.get("ok", false):
		_fail("Delete slot failed: %s" % str(delete_result.get("error", "")))
		return

	print("[TianmingGodotTest] save manager slot scene test passed")
	_finish(0)

func _array(value: Variant) -> Array:
	return value if typeof(value) == TYPE_ARRAY else []

func _fail(message: String) -> void:
	push_error(message)
	if save_manager != null and save_manager.has_method("delete_slot"):
		save_manager.call("delete_slot", slot_id)
	_finish(1)

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] save manager slot scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
