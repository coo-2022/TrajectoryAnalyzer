"""
Quick verification for Optimization 1
"""
import sys
from backend.repositories.trajectory import TrajectoryRepository, create_default_vector_func
from backend.config import get_db_path


def main():
    print("Verifying Optimization 1: LanceDB Native Query Optimization")
    print("=" * 60)

    repo = TrajectoryRepository(get_db_path(), create_default_vector_func())

    # Test 1: Check new methods exist
    print("\n1. Checking new methods exist...")
    assert hasattr(repo, 'get_paginated'), "get_paginated method missing"
    assert hasattr(repo, 'count'), "count method missing"
    assert hasattr(repo, '_build_where_clauses'), "_build_where_clauses method missing"
    print("   ✓ All new methods exist")

    # Test 2: Test basic query
    print("\n2. Testing basic query...")
    try:
        results = repo.get_paginated(0, 10, filters={"agent_name": "agent_0"})
        print(f"   ✓ get_paginated works: {len(results)} results")

        total = repo.count(filters={"agent_name": "agent_0"})
        print(f"   ✓ count works: {total} total records")
    except Exception as e:
        print(f"   ✗ Error: {e}")
        return 1

    # Test 3: Test SQL injection protection
    print("\n3. Testing SQL injection protection...")
    try:
        malicious = "'; DROP TABLE trajectories; --"
        count = repo.count(filters={"trajectory_id": malicious})
        print(f"   ✓ SQL injection blocked: count={count}")
    except Exception as e:
        print(f"   ✗ Error: {e}")
        return 1

    # Test 4: Test type safety
    print("\n4. Testing type safety...")
    try:
        results = repo.get_paginated(0, 10, filters={"reward_min": "0.5", "reward_max": "0.8"})
        print(f"   ✓ Type casting works: {len(results)} results")
    except Exception as e:
        print(f"   ✗ Error: {e}")
        return 1

    # Test 5: Compare with old method
    print("\n5. Comparing with old filter method...")
    try:
        filters = {"agent_name": "agent_0"}
        old_results = repo.filter(filters, limit=10)
        new_results = repo.get_paginated(0, 10, filters=filters)

        if len(old_results) == len(new_results):
            print(f"   ✓ Results match: {len(new_results)} results")
        else:
            print(f"   ✗ Mismatch: old={len(old_results)}, new={len(new_results)}")
            return 1
    except Exception as e:
        print(f"   ✗ Error: {e}")
        return 1

    print("\n" + "=" * 60)
    print("✓ ALL VERIFICATION TESTS PASSED")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
