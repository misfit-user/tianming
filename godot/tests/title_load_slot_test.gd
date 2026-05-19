extends Node

const TitleScene := preload("res://scenes/title.tscn")
const ScenarioLoaderScript := preload("res://scripts/scenario_loader.gd")
const GameStateScript := preload("res://scripts/game_state.gd")
const SaveManagerScript := preload("res://scripts/save_manager.gd")

var save_manager: RefCounted
var slot_id: String = "slot_2"

func _ready() -> void:
	save_manager = SaveManagerScript.new()
	save_manager.call("delete_slot", slot_id)

	var load_result: Dictionary = ScenarioLoaderScript.load_official_summary()
	var saved_state: RefCounted = GameStateScript.new()
	saved_state.call("load_from_scenario_result", load_result)
	saved_state.call("advance_month")
	saved_state.call("advance_month")
	var saved_turn: int = int(saved_state.get("turn"))
	var save_result: Dictionary = save_manager.call("save_to_slot", saved_state, slot_id)
	if not save_result.get("ok", false):
		_fail("Preparing slot save failed: %s" % str(save_result.get("error", "")))
		return

	var title: Node = TitleScene.instantiate()
	add_child(title)
	await get_tree().process_frame
	if not title.has_method("open_load_menu") or not title.has_method("load_game_slot"):
		_fail("Title screen does not expose load slot menu methods")
		return

	title.call("open_load_menu")
	await get_tree().process_frame
	var load_result_from_title: Dictionary = title.call("load_game_slot", slot_id)
	await get_tree().process_frame
	if not load_result_from_title.get("ok", false):
		_fail("Title load slot failed: %s" % str(load_result_from_title.get("error", "")))
		return
	var main: Node = title.get("current_main") as Node
	if main == null:
		_fail("Title load slot did not create a main game instance")
		return
	var state: RefCounted = main.get("game_state") as RefCounted
	if state == null or int(state.get("turn")) != saved_turn:
		_fail("Title load slot did not restore the selected slot turn")
		return

	save_manager.call("delete_slot", slot_id)
	print("[TianmingGodotTest] title load slot scene test passed")
	get_tree().create_timer(1.0).timeout.connect(func() -> void: _finish(0))

func _fail(message: String) -> void:
	if save_manager != null:
		save_manager.call("delete_slot", slot_id)
	print("[TianmingGodotTest] title load slot scene test failed: %s" % message)
	push_error(message)
	get_tree().create_timer(5.0).timeout.connect(func() -> void: _finish(1))

func _finish(exit_code: int) -> void:
	print("[TianmingGodotTest] title load slot scene test exit_code=%d" % exit_code)
	get_tree().quit(exit_code)
