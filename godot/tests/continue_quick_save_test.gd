extends Node

const MainScene := preload("res://scenes/main.tscn")
const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const SaveManagerScript := preload("res://scripts/save_manager.gd")

var save_manager: RefCounted

func _ready() -> void:
	save_manager = SaveManagerScript.new()
	save_manager.call("delete_slot", "quick")

	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	if not load_result.get("ok", false):
		_fail("Scenario load failed: %s" % str(load_result.get("error", "")))
		return
	var saved_state: RefCounted = GameStateScript.new()
	var state_result: Dictionary = saved_state.call("load_from_scenario_result", load_result)
	if not state_result.get("ok", false):
		_fail("State load failed: %s" % str(state_result.get("error", "")))
		return
	saved_state.call("advance_month")
	var saved_turn: int = int(saved_state.get("turn"))
	var save_result: Dictionary = save_manager.call("save_to_slot", saved_state, "quick")
	if not save_result.get("ok", false):
		_fail("Preparing quick save failed: %s" % str(save_result.get("error", "")))
		return

	var main: Node = MainScene.instantiate()
	add_child(main)
	await get_tree().process_frame
	if not main.has_method("continue_from_quick_save"):
		_fail("Main scene does not expose continue_from_quick_save")
		return

	var game_state: RefCounted = main.get("game_state") as RefCounted
	if game_state == null:
		_fail("Main scene did not initialize GameState")
		return
	if int(game_state.get("turn")) == saved_turn:
		_fail("Main scene unexpectedly loaded quick save before continue was requested")
		return

	var continue_result: Dictionary = main.call("continue_from_quick_save")
	await get_tree().process_frame
	if not continue_result.get("ok", false):
		_fail("Continue from quick save failed: %s" % str(continue_result.get("error", "")))
		return
	if int(game_state.get("turn")) != saved_turn:
		_fail("Continue from quick save did not restore the saved turn")
		return

	save_manager.call("delete_slot", "quick")
	print("[TianmingGodotTest] continue quick save scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _fail(message: String) -> void:
	if save_manager != null:
		save_manager.call("delete_slot", "quick")
	print("[TianmingGodotTest] continue quick save scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] continue quick save scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
