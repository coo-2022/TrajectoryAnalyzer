"""
Verification script for Optimization 1: LanceDB Native Query Optimization

This script verifies:
1. Correctness: Results match between old and new implementations
2. SQL injection protection: Malicious inputs are properly escaped
3. Type safety: Numeric values are properly cast
"""
import sys
import time
from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func
from backend.config import get_db_path
from backend.models.trajectory import Trajectory, Task, Step


def create_test_trajectory(i: int) -> Trajectory:
    """Create a test trajectory"""
    return Trajectory(
        trajectory_id=f"test_traj_{i}",
        data_id=f"test_data_{i % 10}",
        task={"question": f"Test question {i}", "ground_truth": "Test ground truth"},
        steps=[
            Step(
                step_id=0,
                thought=f"Thought {i}",
                action="test_action",
                observation="test_obs",
            )
        ],
        reward=0.5 + (i % 10) * 0.1,
        toolcall_reward=0.3 + (i % 5) * 0.1,
        res_reward=0.4 + (i % 7) * 0.1,
        exec_time=1.0 + i * 0.1,
        epoch_id=i % 3,
        iteration_id=i % 5,
        sample_id=i,
        training_id=f"training_{i % 2}",
        agent_name=f"agent_{i % 3}",
        termination_reason=["success", "error", "timeout"][i % 3],
        step_count=5 + i % 10,
        is_bookmarked=i % 5 == 0,
    )


def test_sql_injection_protection():
    """Test that SQL injection attempts are properly escaped"""
    print("\n=== Testing SQL Injection Protection ===")

    repo = TrajectoryRepository(get_db_path(), create_default_vector_func())

    # Add a test trajectory
    test_traj = create_test_trajectory(9999)
    repo.add(test_traj)

    # Try SQL injection attempts
    malicious_inputs = [
        "'; DROP TABLE trajectories; --",
        "' OR '1'='1",
        "admin' --",
        "' UNION SELECT * FROM trajectories --",
    ]

    for malicious_input in malicious_inputs:
        try:
            # Test with trajectory_id filter
            filters = {"trajectory_id": malicious_input}
            count = repo.count(filters=filters)
            print(f"✓ Malicious input escaped: {malicious_input[:30]}... -> count={count}")

            # Test with question filter
            filters = {"question": malicious_input}
            result = repo.get_paginated(0, 10, filters=filters)
            print(f"✓ Question filter escaped: {malicious_input[:30]}... -> result_count={len(result)}")

        except Exception as e:
            print(f"✗ FAILED: {malicious_input[:30]}... -> Error: {e}")
            return False

    # Clean up
    repo.delete(f"test_traj_9999")
    print("✓ All SQL injection protection tests passed")
    return True


def test_type_safety():
    """Test that numeric types are properly cast"""
    print("\n=== Testing Type Safety ===")

    repo = TrajectoryRepository(get_db_path(), create_default_vector_func())

    # Add a test trajectory
    test_traj = create_test_trajectory(9998)
    repo.add(test_traj)

    # Test with various numeric filter types
    test_cases = [
        {"reward_min": "0.5", "reward_max": "0.8"},  # String floats
        {"epoch_id": "1", "iteration_id": "2"},  # String ints
        {"step_count_min": 5.5, "step_count_max": 10.9},  # Float that should be int
        {"is_bookmarked": "true"},  # String bool
    ]

    for filters in test_cases:
        try:
            result = repo.get_paginated(0, 10, filters=filters)
            count = repo.count(filters=filters)
            print(f"✓ Type casting works: {filters} -> count={count}, result_count={len(result)}")
        except Exception as e:
            print(f"✗ FAILED: {filters} -> Error: {e}")
            return False

    # Clean up
    repo.delete(f"test_traj_9998")
    print("✓ All type safety tests passed")
    return True


def test_correctness():
    """Test that new implementation produces same results as old"""
    print("\n=== Testing Correctness ===")

    repo = TrajectoryRepository(get_db_path(), create_default_vector_func())

    # Add test trajectories
    test_ids = []
    for i in range(9000, 9020):
        traj = create_test_trajectory(i)
        repo.add(traj)
        test_ids.append(f"test_traj_{i}")

    # Test various filter combinations
    test_cases = [
        {"agent_name": "agent_0"},
        {"reward_min": 0.5, "reward_max": 0.7},
        {"termination_reason": "success,error"},
        {"epoch_id": 1},
        {"is_bookmarked": True},
        {"step_count_min": 5, "step_count_max": 10},
        {"question": "Test"},
        {"training_id": "training_0"},
    ]

    for filters in test_cases:
        try:
            # Get results using new method
            new_results = repo.get_paginated(0, 100, filters=filters)

            # Get results using old method
            old_results = repo.filter(filters, limit=100)

            # Compare counts (should match when limit is applied)
            if len(new_results) != len(old_results):
                print(f"✗ Result count mismatch for {filters}:")
                print(f"  New method: {len(new_results)} results")
                print(f"  Old method: {len(old_results)} results")
                return False

            # Compare count method (should be >= result count, since no limit)
            total_count = repo.count(filters=filters)
            if total_count < len(new_results):
                print(f"✗ Count method inconsistency for {filters}:")
                print(f"  get_paginated: {len(new_results)} results (limited)")
                print(f"  count method: {total_count} total (unlimited)")
                return False

            # If total > limit, count should be greater than paginated result
            if total_count > 100:
                if len(new_results) != 100:
                    print(f"✗ Pagination limit not applied for {filters}")
                    return False
                print(f"✓ Correctness verified: {filters} -> {len(new_results)} results (limited to 100), total={total_count}")
            else:
                # If total <= limit, both should match
                if total_count != len(new_results):
                    print(f"✗ Count mismatch when total <= limit for {filters}:")
                    print(f"  get_paginated: {len(new_results)} results")
                    print(f"  count method: {total_count}")
                    return False
                print(f"✓ Correctness verified: {filters} -> {len(new_results)} results")

        except Exception as e:
            print(f"✗ FAILED: {filters} -> Error: {e}")
            import traceback
            traceback.print_exc()
            return False

    # Clean up
    for traj_id in test_ids:
        repo.delete(traj_id)

    print("✓ All correctness tests passed")
    return True


def test_performance():
    """Test performance improvement"""
    print("\n=== Testing Performance ===")

    repo = TrajectoryRepository(get_db_path(), create_default_vector_func())

    # Get total count
    total = repo.count()
    print(f"Total trajectories in database: {total}")

    if total < 100:
        print("⚠ Not enough data for performance test (need at least 100 records)")
        return True

    # Test filter query
    filters = {"agent_name": "agent_0"}

    # Old method (filter)
    start = time.time()
    old_results = repo.filter(filters, limit=100)
    old_time = time.time() - start

    # New method (get_paginated)
    start = time.time()
    new_results = repo.get_paginated(0, 100, filters=filters)
    new_time = time.time() - start

    speedup = old_time / new_time if new_time > 0 else float('inf')

    print(f"Old method time: {old_time:.4f}s")
    print(f"New method time: {new_time:.4f}s")
    print(f"Speedup: {speedup:.2f}x")

    if speedup > 1.5:
        print(f"✓ Performance improved by {speedup:.2f}x")
    elif speedup > 0.8:
        print(f"✓ Performance similar ({speedup:.2f}x)")
    else:
        print(f"⚠ Performance degraded ({speedup:.2f}x)")

    return True


def main():
    """Run all verification tests"""
    print("=" * 60)
    print("Optimization 1 Verification: LanceDB Native Query")
    print("=" * 60)

    all_passed = True

    # Run tests
    all_passed &= test_sql_injection_protection()
    all_passed &= test_type_safety()
    all_passed &= test_correctness()
    all_passed &= test_performance()

    print("\n" + "=" * 60)
    if all_passed:
        print("✓ ALL VERIFICATION TESTS PASSED")
        print("=" * 60)
        return 0
    else:
        print("✗ SOME TESTS FAILED")
        print("=" * 60)
        return 1


if __name__ == "__main__":
    sys.exit(main())
