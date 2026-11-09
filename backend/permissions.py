
from fastapi import Depends, HTTPException, status

from auth import get_current_user
from models import User


def require_roles(*allowed_roles: str):
    def check_role(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action.",
            )

        return current_user

    return check_role


require_admin = require_roles("admin")
require_salesperson = require_roles("salesperson")
require_client = require_roles("client")
