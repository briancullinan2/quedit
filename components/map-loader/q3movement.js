
// Much of this file is a simplified/dumbed-down version of the Q3 player movement code
// found in bg_pmove.c and bg_slidemove.c

// Some movement constants ripped from the Q3 Source code
var q3movement_stopspeed = 100.0;
var q3movement_duckScale = 0.25;
var q3movement_jumpvelocity = 50;

var q3movement_accelerate = 10.0;
var q3movement_airaccelerate = 0.1;
var q3movement_flyaccelerate = 8.0;

var q3movement_friction = 6.0;
var q3movement_flightfriction = 3.0;

var q3movement_frameTime = 0.30;
var q3movement_overclip = 1.001;
var q3movement_stepsize = 18;

var q3movement_gravity = 20.0;

var q3movement_playerRadius = 10.0;
var q3movement_scale = 50;

q3movement = function (bsp)
{
	this.bsp = bsp;

	this.velocity = [0, 0, 0];
	this.position = [0, 0, 0];
	this.onGround = false;

	this.groundTrace = null;
};

q3movement.prototype.applyFriction = function ()
{
	if(!this.onGround) { return; }

	var speed = vec3.length(this.velocity);

	var drop = 0;

	var control = speed < q3movement_stopspeed ? q3movement_stopspeed : speed;
	drop += control * q3movement_friction * q3movement_frameTime;

	var newSpeed = speed - drop;
	if(newSpeed < 0)
	{
		newSpeed = 0;
	}
	if(speed !== 0)
	{
		newSpeed /= speed;
		vec3.scale(this.velocity, this.velocity, newSpeed);
	} else
	{
		this.velocity = [0, 0, 0];
	}
};

q3movement.prototype.groundCheck = function ()
{
	var checkPoint = [this.position[0], this.position[1], this.position[2] - q3movement_playerRadius - 0.25];

	this.groundTrace = this.bsp.trace(this.position, checkPoint, q3movement_playerRadius);

	if(this.groundTrace.fraction == 1.0)
	{ // falling
		this.onGround = false;
		return;
	}

	if(this.velocity[2] > 0 && vec3.dot(this.velocity, this.groundTrace.plane.normal) > 10)
	{ // jumping
		this.onGround = false;
		return;
	}

	if(this.groundTrace.plane.normal[2] < 0.7)
	{ // steep slope
		this.onGround = false;
		return;
	}

	this.onGround = true;
};


q3movement.prototype.clipVelocity = function (velIn, normal)
{
	var backoff = vec3.dot(velIn, normal);

	if(backoff < 0)
	{
		backoff *= q3movement_overclip;
	} else
	{
		backoff /= q3movement_overclip;
	}

	var out = [0, 0, 0];
	out[0] = velIn[0] - (normal[0] * backoff);
	out[1] = velIn[1] - (normal[1] * backoff);
	out[2] = velIn[2] - (normal[2] * backoff);
	return out;
};
q3movement.prototype.accelerate = function (dir, speed, accel)
{
	var currentSpeed = vec3.dot(this.velocity, dir);
	var addSpeed = speed - currentSpeed;
	if(addSpeed <= 0)
	{
		return;
	}

	var accelSpeed = accel * q3movement_frameTime * speed;
	if(accelSpeed > addSpeed)
	{
		accelSpeed = addSpeed;
	}

	var accelDir = vec3.scale([0, 0, 0], dir, accelSpeed);
	vec3.add(this.velocity, this.velocity, accelDir);
};

q3movement.prototype.jump = function ()
{
	if(!this.onGround) { return false; }

	this.onGround = false;
	this.velocity[2] = q3movement_jumpvelocity;

	//Make sure that the player isn't stuck in the ground
	var groundDist = vec3.dot(this.position, this.groundTrace.plane.normal) - this.groundTrace.plane.distance - q3movement_playerRadius;
	vec3.add(this.position, this.position, vec3.scale([0, 0, 0], this.groundTrace.plane.normal, groundDist + 5));

	return true;
};

q3movement.prototype.move = function (dir, frameTime)
{
	q3movement_frameTime = frameTime * 0.0075;

	this.groundCheck();

	vec3.normalize(dir, dir);

	if(this.onGround)
	{
		this.walkMove(dir);
	} else
	{
		this.airMove(dir);
	}

	return this.position;
};

q3movement.prototype.airMove = function (dir)
{
	var speed = vec3.length(dir) * q3movement_scale;

	this.accelerate(dir, speed, q3movement_airaccelerate);

	this.stepSlideMove(true);
};

q3movement.prototype.walkMove = function (dir)
{
	this.applyFriction();

	var speed = vec3.length(dir) * q3movement_scale;

	this.accelerate(dir, speed, q3movement_accelerate);

	this.velocity = this.clipVelocity(this.velocity, this.groundTrace.plane.normal);

	if(!this.velocity[0] && !this.velocity[1]) { return; }

	this.stepSlideMove(false);
};



q3movement.prototype.slideMove = function (gravity)
{
	var bumpcount;
	var numbumps = 4;
	var planes = [];
	var numplanes = 0;
	var primal_velocity = vec3.copy([0, 0, 0], this.velocity);
	var endVelocity = [0, 0, 0];

	if(gravity)
	{
		vec3.copy(endVelocity, this.velocity);
		endVelocity[2] -= q3movement_gravity * q3movement_frameTime;
		this.velocity[2] = (this.velocity[2] + endVelocity[2]) * 0.5;
		primal_velocity[2] = endVelocity[2];

		if(this.groundTrace && this.groundTrace.plane)
		{
			this.velocity = this.clipVelocity(this.velocity, this.groundTrace.plane.normal);
		}
	}

	// Never turn against the ground plane
	if(this.groundTrace && this.groundTrace.plane)
	{
		planes[numplanes] = vec3.copy([0, 0, 0], this.groundTrace.plane.normal);
		numplanes++;
	}

	// Never turn against original velocity
	planes[numplanes] = vec3.normalize([0, 0, 0], this.velocity);
	numplanes++;

	var time_left = q3movement_frameTime;
	var end = [0, 0, 0];

	bumpLoop:
	for(bumpcount = 0; bumpcount < numbumps; ++bumpcount)
	{
		// Calculate position we are trying to move to
		vec3.add(end, this.position, vec3.scale([0, 0, 0], this.velocity, time_left));

		// See if we can make it there
		var trace = this.bsp.trace(this.position, end, q3movement_playerRadius);

		if(trace.allSolid)
		{
			this.velocity[2] = 0;   // Don't build up falling damage
			return true;
		}

		if(trace.fraction > 0)
		{
			// actually covered some distance
			vec3.copy(this.position, trace.endPos);

			// ─── CRITICAL EPSILON PULL-BACK ───
			// If we didn't make it the full distance, we are resting flush against a wall plane.
			// We must back the player position off the wall by a microscopic margin (0.03125 units)
			// so the next trace sequence doesn't start already stuck inside the solid brush.
			if(trace.fraction < 1.0)
			{
				this.position[0] += trace.plane.normal[0] * 0.03125;
				this.position[1] += trace.plane.normal[1] * 0.03125;
				this.position[2] += trace.plane.normal[2] * 0.03125;
			}
		}

		if(trace.fraction == 1)
		{
			break;     // Moved the entire distance smoothly
		}

		time_left -= time_left * trace.fraction;

		if(numplanes >= 5)
		{
			this.velocity = [0, 0, 0];
			return true;
		}

		// ─── THE NATIVE EPSILON NUDGE CHECK ───
		// If this is a plane we already bounced against, push out along it slightly
		// to handle precision limitations of non-axial collision shapes.
		var p;
		for(p = 0; p < numplanes; p++)
		{
			if(vec3.dot(trace.plane.normal, planes[p]) > 0.99)
			{
				vec3.add(this.velocity, this.velocity, trace.plane.normal);
				break;
			}
		}
		if(p < numplanes)
		{
			continue bumpLoop; // Re-run movement logic pass with the nudged vector
		}

		planes[numplanes] = vec3.copy([0, 0, 0], trace.plane.normal);
		numplanes++;

		// Modify velocity so it parallels all of the clip planes
		var i, j, k;
		for(i = 0; i < numplanes; i++)
		{
			var into = vec3.dot(this.velocity, planes[i]);
			if(into >= 0.1) { continue; } // Move doesn't interact with the plane

			// Slide along the plane
			var clipVelocity = this.clipVelocity(this.velocity, planes[i]);
			var endClipVelocity = this.clipVelocity(endVelocity, planes[i]);

			// See if there is a second plane that the new move enters
			for(var j = 0; j < numplanes; j++)
			{
				if(j == i) { continue; }
				if(vec3.dot(clipVelocity, planes[j]) >= 0.1) { continue; }

				// Try clipping the move to the plane
				clipVelocity = this.clipVelocity(clipVelocity, planes[j]);
				endClipVelocity = this.clipVelocity(endClipVelocity, planes[j]);

				// See if it goes back into the first clip plane
				if(vec3.dot(clipVelocity, planes[i]) >= 0) { continue; }

				// Slide the original velocity along the intersection crease line
				var dir = [0, 0, 0];
				vec3.cross(dir, planes[i], planes[j]);
				vec3.normalize(dir, dir);
				var d = vec3.dot(dir, this.velocity);
				clipVelocity = vec3.scale([0, 0, 0], dir, d);

				vec3.cross(dir, planes[i], planes[j]);
				vec3.normalize(dir, dir);
				d = vec3.dot(dir, endVelocity);
				endClipVelocity = vec3.scale([0, 0, 0], dir, d);

				// See if there is a third plane that the new crease move enters
				for(var k = 0; k < numplanes; k++)
				{
					if(k == i || k == j) { continue; }
					if(vec3.dot(clipVelocity, planes[k]) >= 0.1) { continue; }

					// Stop dead at a triple plane corner intersection
					this.velocity = [0, 0, 0];
					return true;
				}
			}

			// If we have fixed all interactions, proceed to next iteration phase
			vec3.copy(this.velocity, clipVelocity);
			vec3.copy(endVelocity, endClipVelocity);
			break;
		}
	}

	if(gravity)
	{
		vec3.copy(this.velocity, endVelocity);
	}

	// If the movement code is processing an active time block constraint (e.g., knockback),
	// override sliding modifications to enforce the strict historical velocity path.
	if(this.pm_time)
	{
		vec3.copy(this.velocity, primal_velocity);
	}

	return (bumpcount !== 0);
};




q3movement.prototype.stepSlideMove = function (gravity)
{
	var start_o = vec3.copy([0, 0, 0], this.position);
	var start_v = vec3.copy([0, 0, 0], this.velocity);

	// If slideMove returns false (0), it means we reached the target location
	// on the first try without bouncing off any wall planes.
	if(!this.slideMove(gravity)) { return; }

	var down = vec3.copy([0, 0, 0], start_o);
	down[2] -= q3movement_stepsize;
	var trace = this.bsp.trace(start_o, down, q3movement_playerRadius);

	var up = [0, 0, 1];

	// Never step up when you still have upward vertical velocity
	if(this.velocity[2] > 0 && (trace.fraction == 1.0 || vec3.dot(trace.plane.normal, up) < 0.7)) { return; }

	vec3.copy(up, start_o);
	up[2] += q3movement_stepsize;

	// Test the player bounds room directly above them
	trace = this.bsp.trace(start_o, up, q3movement_playerRadius);
	if(trace.allSolid) { return; } // Can't step up due to blocked ceiling environment

	var stepSize = trace.endPos[2] - start_o[2];

	// Teleport up and re-run slideMove path from the elevated plane threshold
	vec3.copy(this.position, trace.endPos);
	vec3.copy(this.velocity, start_v);

	this.slideMove(gravity);

	// Push the player volume down onto the stepped landing face structure
	vec3.copy(down, this.position);
	down[2] -= stepSize;
	trace = this.bsp.trace(this.position, down, q3movement_playerRadius);
	if(!trace.allSolid)
	{
		vec3.copy(this.position, trace.endPos);

		// ─── STEP LEDGE PULL-BACK ───
		if(trace.fraction < 1.0)
		{
			this.position[0] += trace.plane.normal[0] * 0.03125;
			this.position[1] += trace.plane.normal[1] * 0.03125;
			this.position[2] += trace.plane.normal[2] * 0.03125;
		}
	}
	if(trace.fraction < 1.0)
	{
		this.velocity = this.clipVelocity(this.velocity, trace.plane.normal);
	}
};
